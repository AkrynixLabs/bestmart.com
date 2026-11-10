import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

import { decodeCursor, encodeCursor } from "./cursor"
import type { CatalogQuery, CatalogResult, CatalogSearch } from "./types"

// Postgres implementation: full-text search (weighted tsvector maintained by
// a trigger) plus pg_trgm word similarity on titles for typos and partial
// words. Keyset pagination for browse sorts, so page 500 costs the same as
// page 1; relevance-sorted search uses capped page numbers.

export const MAX_RELEVANCE_PAGE = 20

export const postgresCatalogSearch: CatalogSearch = {
  async query(q: CatalogQuery): Promise<CatalogResult> {
    if (q.categoryIds.length === 0) return { ids: [], nextCursor: null, nextPage: null }

    const text = q.text?.trim().slice(0, 100) || undefined
    const sort = q.sort === "relevance" && !text ? "newest" : q.sort
    const where: Prisma.Sql[] = [
      Prisma.sql`p."status" = 'active'`,
      Prisma.sql`p."blockedAt" IS NULL`,
      Prisma.sql`s."status" = 'active'`,
      Prisma.sql`p."categoryId" = ANY(${q.categoryIds}::text[])`,
    ]
    if (q.storeId) where.push(Prisma.sql`p."storeId" = ${q.storeId}`)
    // A product matches a price filter if any of its variants could.
    if (q.minPrice !== undefined) where.push(Prisma.sql`p."maxPrice" >= ${q.minPrice}`)
    if (q.maxPrice !== undefined) where.push(Prisma.sql`p."minPrice" <= ${q.maxPrice}`)
    if (text) {
      where.push(Prisma.sql`(p."searchVector" @@ websearch_to_tsquery('english', ${text}) OR ${text} <% p."title")`)
    }
    for (const filter of q.attributes ?? []) {
      const match =
        filter.kind === "values"
          ? Prisma.sql`v."textValues" && ${filter.values}::text[]`
          : filter.kind === "boolean"
            ? Prisma.sql`v."booleanValue" = ${filter.value}`
            : Prisma.join(
                [
                  Prisma.sql`v."numberValue" IS NOT NULL`,
                  ...(filter.min !== undefined ? [Prisma.sql`v."numberValue" >= ${filter.min}`] : []),
                  ...(filter.max !== undefined ? [Prisma.sql`v."numberValue" <= ${filter.max}`] : []),
                ],
                " AND ",
              )
      where.push(
        Prisma.sql`EXISTS (SELECT 1 FROM "product_attribute_values" v WHERE v."productId" = p."id" AND v."attributeId" = ${filter.attributeId} AND ${match})`,
      )
    }

    const from = Prisma.sql`FROM "products" p JOIN "stores" s ON s."id" = p."storeId"`
    const limit = Math.min(Math.max(q.limit, 1), 60)

    if (sort === "relevance" && text) {
      const page = Math.min(Math.max(q.page ?? 1, 1), MAX_RELEVANCE_PAGE)
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p."id" ${from}
        WHERE ${Prisma.join(where, " AND ")}
        ORDER BY ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${text})) + word_similarity(${text}, p."title") DESC, p."id"
        LIMIT ${limit + 1} OFFSET ${(page - 1) * limit}`
      const hasMore = rows.length > limit && page < MAX_RELEVANCE_PAGE
      return { ids: rows.slice(0, limit).map((r) => r.id), nextCursor: null, nextPage: hasMore ? page + 1 : null }
    }

    const cursor = decodeCursor(q.after, sort)
    let order: Prisma.Sql
    if (sort === "price_asc") {
      order = Prisma.sql`p."minPrice" ASC, p."id" ASC`
      if (cursor) where.push(Prisma.sql`(p."minPrice", p."id") > (${cursor.value}::int, ${cursor.id})`)
    } else if (sort === "price_desc") {
      order = Prisma.sql`p."minPrice" DESC, p."id" DESC`
      if (cursor) where.push(Prisma.sql`(p."minPrice", p."id") < (${cursor.value}::int, ${cursor.id})`)
    } else {
      order = Prisma.sql`p."publishedAt" DESC, p."id" DESC`
      if (cursor) where.push(Prisma.sql`(p."publishedAt", p."id") < (${cursor.value}::timestamp, ${cursor.id})`)
    }

    const rows = await prisma.$queryRaw<{ id: string; minPrice: number; publishedAt: Date | null }[]>`
      SELECT p."id", p."minPrice", p."publishedAt" ${from}
      WHERE ${Prisma.join(where, " AND ")}
      ORDER BY ${order}
      LIMIT ${limit + 1}`
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    const nextCursor =
      rows.length > limit && last
        ? encodeCursor(sort, sort === "newest" ? (last.publishedAt ?? new Date(0)).toISOString() : last.minPrice, last.id)
        : null
    return { ids: page.map((r) => r.id), nextCursor, nextPage: null }
  },
}
