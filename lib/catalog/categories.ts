import "server-only"
import { unstable_cache, updateTag } from "next/cache"
import { cache } from "react"

import { prisma } from "@/lib/prisma"

import { buildTree, type CategoryTree, type TreeCategory } from "./tree"

export const CATEGORIES_TAG = "categories"

// The whole tree in one query, cached across requests. Every admin change to
// categories or attributes calls invalidateCategories(), so the storefront,
// menus and filters update on the next request with no deploy.
const loadCategories = unstable_cache(
  async (): Promise<TreeCategory[]> => {
    const rows = await prisma.category.findMany({
      orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: { attributes: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    })
    return rows.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      depth: c.depth,
      sortOrder: c.sortOrder,
      status: c.status,
      commissionBps: c.commissionBps,
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
      attributes: c.attributes.map((a) => ({
        id: a.id,
        categoryId: a.categoryId,
        key: a.key,
        name: a.name,
        type: a.type,
        unit: a.unit,
        options: a.options,
        isRequired: a.isRequired,
        isFilterable: a.isFilterable,
        sortOrder: a.sortOrder,
      })),
    }))
  },
  ["category-tree-v1"],
  { tags: [CATEGORIES_TAG], revalidate: 3600 },
)

/** The category tree for this request (cached; Maps are rebuilt per request). */
export const getCategoryTree = cache(async (): Promise<CategoryTree> => buildTree(await loadCategories()))

/** Call from Server Actions after any category or attribute change. */
export function invalidateCategories() {
  updateTag(CATEGORIES_TAG)
}
