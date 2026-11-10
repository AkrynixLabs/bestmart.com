"use server"

import { revalidatePath } from "next/cache"

import { echoValues, type FormState } from "@/lib/actions/state"
import { getCategoryTree } from "@/lib/catalog/categories"
import { actionSellerStore } from "@/lib/catalog/seller"
import { MAX_CATEGORY_DEPTH } from "@/lib/catalog/tree"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"
import { categorySuggestionSchema } from "@/lib/validation/catalog"
import { fieldErrors } from "@/lib/validation/common"

export async function suggestCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return { error: "Your session has ended or your store isn't active. Please sign in again." }
  const values = echoValues(formData)
  const parsed = categorySuggestionSchema.safeParse(values)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }
  const { name, parentId, note } = parsed.data

  const tree = await getCategoryTree()
  if (parentId) {
    const parent = tree.byId.get(parentId)
    if (!parent || parent.depth >= MAX_CATEGORY_DEPTH) return { fieldErrors: { parentId: "Choose one of the listed categories." }, values }
  }
  const exists = tree.all.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.parentId === parentId)
  if (exists && exists.status === "active") return { fieldErrors: { name: "That category already exists. Pick it when adding a product." }, values }

  const { allowed } = await checkRateLimit("category-suggestion", seller.store.id)
  if (!allowed) return { error: "You've sent a lot of suggestions today. Please try again tomorrow.", values }

  const pending = await prisma.categorySuggestion.findFirst({ where: { storeId: seller.store.id, status: "pending", name: { equals: name, mode: "insensitive" } } })
  if (pending) return { error: "You've already suggested this; our team will review it soon.", values }

  await prisma.categorySuggestion.create({ data: { storeId: seller.store.id, name, parentId, note: note ?? null } })
  revalidatePath("/seller/categories")
  return { success: "Thanks! Our team will review your suggestion and email you." }
}
