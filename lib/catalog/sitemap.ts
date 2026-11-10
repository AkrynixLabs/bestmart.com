import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { appUrl } from "@/lib/site"

import { getCategoryTree } from "./categories"
import { visibleIds } from "./tree"

// Sitemaps are built on request (no database needed at build time) and
// split into files of SITEMAP_CHUNK product URLs, well under the protocol's
// 50,000 limit, so they scale with the catalog.

export const SITEMAP_CHUNK = 10_000

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!)

export function xmlResponse(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  })
}

export function urlset(entries: { loc: string; lastmod?: Date }[]): string {
  const urls = entries.map((e) => `<url><loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ""}</url>`).join("")
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
}

async function publicProductWhere(): Promise<Prisma.Sql> {
  const ids = visibleIds(await getCategoryTree())
  return Prisma.sql`p."status" = 'active' AND p."blockedAt" IS NULL AND s."status" = 'active' AND p."categoryId" = ANY(${ids}::text[])`
}

export async function publicProductCount(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM "products" p JOIN "stores" s ON s."id" = p."storeId" WHERE ${await publicProductWhere()}`
  return Number(rows[0]?.count ?? 0)
}

export async function productSitemapChunk(index: number): Promise<{ slug: string; updatedAt: Date }[]> {
  return prisma.$queryRaw<{ slug: string; updatedAt: Date }[]>`
    SELECT p."slug", p."updatedAt" FROM "products" p JOIN "stores" s ON s."id" = p."storeId"
    WHERE ${await publicProductWhere()}
    ORDER BY p."id" LIMIT ${SITEMAP_CHUNK} OFFSET ${index * SITEMAP_CHUNK}`
}

export async function pageSitemapEntries(): Promise<{ loc: string; lastmod?: Date }[]> {
  const tree = await getCategoryTree()
  const visible = new Set(visibleIds(tree))
  const stores = await prisma.store.findMany({ where: { status: "active" }, select: { slug: true, updatedAt: true }, orderBy: { createdAt: "asc" } })
  const base = appUrl()
  return [
    { loc: `${base}/` },
    ...tree.all.filter((c) => visible.has(c.id)).map((c) => ({ loc: `${base}/c/${c.slug}` })),
    ...stores.map((s) => ({ loc: `${base}/s/${s.slug}`, lastmod: s.updatedAt })),
    { loc: `${base}/sell/apply` },
    { loc: `${base}/terms` },
    { loc: `${base}/privacy` },
  ]
}
