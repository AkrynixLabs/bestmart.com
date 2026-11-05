import "server-only"
import { randomUUID } from "node:crypto"

import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/slug"

import { MAX_CATEGORY_DEPTH } from "./tree"

/** A slug is free if no category uses it now and none used it before (old links). */
export async function categorySlugTaken(slug: string, exceptCategoryId?: string): Promise<boolean> {
  const [category, redirectRow] = await Promise.all([
    prisma.category.findUnique({ where: { slug }, select: { id: true } }),
    prisma.categorySlugRedirect.findUnique({ where: { slug }, select: { categoryId: true } }),
  ])
  if (category && category.id !== exceptCategoryId) return true
  // A category may take back one of its own old slugs.
  return Boolean(redirectRow && redirectRow.categoryId !== exceptCategoryId)
}

export async function uniqueCategorySlug(name: string, exceptCategoryId?: string): Promise<string> {
  const base = slugify(name).replace(/^store$/, "category")
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`
    if (!(await categorySlugTaken(candidate, exceptCategoryId))) return candidate
  }
  return `${base}-${randomUUID().slice(0, 6)}`
}

export const newCategoryId = () => `cat_${randomUUID().replace(/-/g, "").slice(0, 20)}`

/** Where a new category goes: its depth and path prefix, or an error. */
export async function placement(parentId: string | null): Promise<{ depth: number; parentPath: string } | { error: string }> {
  if (!parentId) return { depth: 0, parentPath: "/" }
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { depth: true, path: true } })
  if (!parent) return { error: "That parent category doesn't exist." }
  if (parent.depth + 1 > MAX_CATEGORY_DEPTH) return { error: "Categories can be at most three levels deep." }
  return { depth: parent.depth + 1, parentPath: parent.path }
}

export async function createCategory(
  tx: Prisma.TransactionClient,
  data: Omit<Prisma.CategoryUncheckedCreateInput, "id" | "path" | "depth"> & { slug: string },
  where: { depth: number; parentPath: string },
): Promise<string> {
  const id = newCategoryId()
  await tx.category.create({ data: { ...data, id, depth: where.depth, path: `${where.parentPath}${id}/` } })
  return id
}
