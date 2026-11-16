"use server"

import { revalidatePath } from "next/cache"

import { echoValues, type FormState } from "@/lib/actions/state"
import { actionSellerStore } from "@/lib/catalog/seller"
import { prisma } from "@/lib/prisma"
import { replyToReview, ReviewError } from "@/lib/reviews/service"
import { requiredText } from "@/lib/validation/common"

export async function replyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return { error: "Your session has ended or your store isn't active." }
  const values = echoValues(formData)
  const reply = requiredText("Reply", 1000).safeParse(formData.get("reply") ?? "")
  if (!reply.success) return { fieldErrors: { reply: reply.error.issues[0]?.message ?? "Required" }, values }
  const reviewId = String(formData.get("reviewId") ?? "")
  try {
    await replyToReview(seller.store.id, reviewId, reply.data)
  } catch (error) {
    if (error instanceof ReviewError) return { error: error.message }
    throw error
  }
  const r = await prisma.review.findUnique({ where: { id: reviewId }, select: { product: { select: { slug: true } } } })
  if (r) revalidatePath(`/p/${r.product.slug}`)
  revalidatePath("/seller/reviews")
  return { success: "Reply posted." }
}
