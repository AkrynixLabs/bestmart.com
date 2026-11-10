import "server-only"
import { cache } from "react"

import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { catalogSearch, type CatalogQuery } from "@/lib/search"

import { getCategoryTree } from "./categories"
import { aggregates } from "./product-rules"
import { isVisible, visibleIds } from "./tree"

export type ProductCard = {
  id: string
  slug: string
  title: string
  minPrice: number
  maxPrice: number
  compareAtPrice: number | null
  inStock: boolean
  image: { url: string; alt: string } | null
  store: { name: string; slug: string }
}

/** Cards for a list of ids, in the same order. */
export async function getProductCards(ids: string[]): Promise<ProductCard[]> {
  if (ids.length === 0) return []
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      title: true,
      minPrice: true,
      maxPrice: true,
      totalStock: true,
      store: { select: { name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
      variants: { where: { isActive: true }, orderBy: { price: "asc" }, take: 1, select: { compareAtPrice: true } },
    },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids.flatMap((id) => {
    const r = byId.get(id)
    if (!r) return []
    const image = r.images[0]
    return [
      {
        id: r.id,
        slug: r.slug,
        title: r.title,
        minPrice: r.minPrice,
        maxPrice: r.maxPrice,
        compareAtPrice: r.variants[0]?.compareAtPrice ?? null,
        inStock: r.totalStock > 0,
        image: image ? { url: image.url, alt: image.alt ?? r.title } : null,
        store: r.store,
      },
    ]
  })
}

/** Runs a catalog query and returns cards plus the next-page pointers. */
export async function searchCatalog(query: CatalogQuery) {
  const result = await catalogSearch.query(query)
  return { ...result, products: await getProductCards(result.ids) }
}

/** Every category shoppers can currently see. */
export async function visibleCategoryIds(): Promise<string[]> {
  return visibleIds(await getCategoryTree())
}

/** The newest visible products, for the home page. */
export async function newArrivals(limit = 12): Promise<ProductCard[]> {
  const { products } = await searchCatalog({ categoryIds: await visibleCategoryIds(), sort: "newest", limit })
  return products
}

const productInclude = {
  store: { select: { id: true, name: true, slug: true, status: true, userId: true, city: true, region: true, createdAt: true } },
  images: { orderBy: { sortOrder: "asc" } },
  variants: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  attributeValues: true,
} satisfies Prisma.ProductInclude

export type ProductWithDetails = Prisma.ProductGetPayload<{ include: typeof productInclude }>

export const getProductBySlug = cache(async (slug: string) => prisma.product.findUnique({ where: { slug }, include: productInclude }))

/** Whether shoppers can see this product right now. */
export async function isProductPublic(product: Pick<ProductWithDetails, "status" | "blockedAt" | "categoryId"> & { store: { status: string } }) {
  if (product.status !== "active" || product.blockedAt || product.store.status !== "active") return false
  return isVisible(await getCategoryTree(), product.categoryId)
}

/**
 * Recomputes the listing columns (price range, stock) from the variants.
 * Call inside the same transaction as any variant change.
 */
export async function syncProductAggregates(tx: Prisma.TransactionClient, productId: string) {
  const variants = await tx.productVariant.findMany({ where: { productId }, select: { price: true, stock: true, isActive: true } })
  await tx.product.update({ where: { id: productId }, data: aggregates(variants) })
}
