"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { echoValues, type FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { ADMIN_ROLES, actionUser } from "@/lib/auth/session"
import { getCategoryTree, invalidateCategories } from "@/lib/catalog/categories"
import { createCategory, placement, uniqueCategorySlug } from "@/lib/catalog/category-admin"
import { categoryLabel } from "@/lib/catalog/tree"
import { sendEmail } from "@/lib/email/send"
import { categorySuggestionAcceptedMessage, categorySuggestionDeclinedMessage } from "@/lib/email/templates"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { categorySuggestionSchema, reviewSuggestionSchema } from "@/lib/validation/catalog"
import { fieldErrors } from "@/lib/validation/common"

const NOT_ALLOWED: FormState = { error: "You don't have permission to do that." }

async function notify(email: { to: string; subject: string; html: string; text: string }) {
  try {
    await sendEmail(email)
  } catch (error) {
    logger.error("suggestion email failed", { error: error instanceof Error ? error.message : String(error) })
  }
}

export async function acceptSuggestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return NOT_ALLOWED
  const values = echoValues(formData)
  const review = reviewSuggestionSchema.safeParse(values)
  // The admin may adjust the name and parent before adding it.
  const parsed = categorySuggestionSchema.safeParse(values)
  if (!review.success || !parsed.success) return { fieldErrors: { ...(parsed.success ? {} : fieldErrors(parsed.error)) }, values }
  const place = await placement(parsed.data.parentId)
  if ("error" in place) return { fieldErrors: { parentId: place.error }, values }
  const slug = await uniqueCategorySlug(parsed.data.name)
  const ip = await clientIp()

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.categorySuggestion.updateMany({
      where: { id: review.data.suggestionId, status: "pending" },
      data: { status: "accepted", reviewedById: admin.id, reviewedAt: new Date(), response: review.data.response ?? null },
    })
    if (claimed.count !== 1) return null
    const categoryId = await createCategory(tx, { name: parsed.data.name, slug, parentId: parsed.data.parentId }, place)
    const suggestion = await tx.categorySuggestion.update({
      where: { id: review.data.suggestionId },
      data: { createdCategoryId: categoryId },
      include: { store: { include: { user: { select: { email: true, name: true } } } } },
    })
    await audit({ actorId: admin.id, action: "category_suggestion.accepted", entityType: "category_suggestion", entityId: suggestion.id, metadata: { categoryId }, ip }, tx)
    return { suggestion, categoryId }
  })
  if (!result) return { error: "This suggestion was already reviewed." }

  invalidateCategories()
  revalidatePath("/admin/category-suggestions")
  const tree = await getCategoryTree()
  const { suggestion, categoryId } = result
  await notify({ to: suggestion.store.user.email, ...categorySuggestionAcceptedMessage(suggestion.store.user.name, suggestion.name, categoryLabel(tree, categoryId) || parsed.data.name) })
  // The card leaves the pending list, so confirm at page level.
  redirect(`/admin/category-suggestions?added=${encodeURIComponent(categoryId)}`)
}

export async function declineSuggestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return NOT_ALLOWED
  const values = echoValues(formData)
  const review = reviewSuggestionSchema.safeParse(values)
  if (!review.success) return { fieldErrors: fieldErrors(review.error), values }
  const ip = await clientIp()

  const suggestion = await prisma.$transaction(async (tx) => {
    const claimed = await tx.categorySuggestion.updateMany({
      where: { id: review.data.suggestionId, status: "pending" },
      data: { status: "declined", reviewedById: admin.id, reviewedAt: new Date(), response: review.data.response ?? null },
    })
    if (claimed.count !== 1) return null
    await audit({ actorId: admin.id, action: "category_suggestion.declined", entityType: "category_suggestion", entityId: review.data.suggestionId, ip }, tx)
    return tx.categorySuggestion.findUniqueOrThrow({ where: { id: review.data.suggestionId }, include: { store: { include: { user: { select: { email: true, name: true } } } } } })
  })
  if (!suggestion) return { error: "This suggestion was already reviewed." }
  revalidatePath("/admin/category-suggestions")
  await notify({ to: suggestion.store.user.email, ...categorySuggestionDeclinedMessage(suggestion.store.user.name, suggestion.name, suggestion.response) })
  redirect("/admin/category-suggestions?declined=1")
}
