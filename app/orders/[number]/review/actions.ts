"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { echoValues, type FormState } from "@/lib/actions/state"
import { actionUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { MAX_REVIEW_LENGTH, validRating } from "@/lib/reviews/rules"
import { createReview, ReviewError } from "@/lib/reviews/service"

export async function createReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return { error: "Your session has ended. Please sign in again." }
  const values = echoValues(formData)
  const rating = validRating(formData.get("rating"))
  if (!rating) return { fieldErrors: { rating: "Choose 1 to 5 stars" }, values }
  const body = String(formData.get("body") ?? "").trim().replace(/\r\n?/g, "\n") || null
  if (body && body.length > MAX_REVIEW_LENGTH) return { fieldErrors: { body: `${MAX_REVIEW_LENGTH} characters at most` }, values }
  const photo = formData.get("photo")
  let productId: string
  try {
    productId = await createReview({ userId: user.id, orderItemId: String(formData.get("orderItemId") ?? ""), rating, body, photo: photo instanceof File ? photo : null })
  } catch (error) {
    if (error instanceof ReviewError) return { error: error.message, values }
    throw error
  }
  const slug = (await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } }))?.slug
  if (slug) revalidatePath(`/p/${slug}`)
  redirect(`/orders/${String(formData.get("orderNumber") ?? "")}?reviewed=1`)
}
