import "server-only"
import { randomUUID } from "node:crypto"

import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { putPublic } from "@/lib/storage"
import { EXTENSION, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/validation/files"

import { averageRating, MAX_REVIEW_LENGTH } from "./rules"

export class ReviewError extends Error {}

/** Order lines a buyer may review: delivered (or completed) parts, product still exists, not yet reviewed. */
export async function reviewableItems(userId: string, orderNumber?: string) {
  return prisma.orderItem.findMany({
    where: {
      productId: { not: null },
      review: null,
      subOrder: { status: { in: ["delivered", "completed"] }, order: { userId, ...(orderNumber ? { number: orderNumber } : {}) } },
    },
    select: { id: true, title: true, optionValues: true, productId: true, subOrder: { select: { order: { select: { number: true } } } } },
  })
}

/** Recomputes a product's rating summary from its visible reviews. */
export async function refreshRating(tx: Prisma.TransactionClient, productId: string) {
  const rows = await tx.review.findMany({ where: { productId, status: "visible" }, select: { rating: true } })
  await tx.product.update({ where: { id: productId }, data: { ratingAvg: averageRating(rows.map((r) => r.rating)), ratingCount: rows.length } })
}

export async function createReview({ userId, orderItemId, rating, body, photo }: { userId: string; orderItemId: string; rating: number; body: string | null; photo: File | null }) {
  const item = await prisma.orderItem.findFirst({
    where: { id: orderItemId, subOrder: { order: { userId } } },
    include: { subOrder: { select: { status: true, storeId: true } }, review: { select: { id: true } } },
  })
  if (!item) throw new ReviewError("Order item not found.")
  if (item.review) throw new ReviewError("You've already reviewed this.")
  if (item.subOrder.status !== "delivered" && item.subOrder.status !== "completed") throw new ReviewError("You can review once the order has been delivered.")
  if (!item.productId) throw new ReviewError("This product is no longer on BestMart.")
  if (body && body.length > MAX_REVIEW_LENGTH) throw new ReviewError("Your review is too long.")

  let photoUrl: string | null = null
  let photoKey: string | null = null
  if (photo && photo.size > 0) {
    if (photo.size > MAX_UPLOAD_BYTES) throw new ReviewError("The photo must be 4 MB or smaller.")
    const bytes = new Uint8Array(await photo.arrayBuffer())
    const type = sniffImageType(bytes)
    if (!type) throw new ReviewError("Photos must be JPG, PNG or WebP images.")
    const stored = await putPublic(`reviews/${item.productId}/${randomUUID()}.${EXTENSION[type]}`, bytes, type)
    photoUrl = stored.url
    photoKey = stored.key
  }

  const productId = item.productId
  try {
    await prisma.$transaction(async (tx) => {
      await tx.review.create({ data: { orderItemId, productId, storeId: item.subOrder.storeId, userId, rating, body, photoUrl, photoKey } })
      await refreshRating(tx, productId)
    })
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") throw new ReviewError("You've already reviewed this.")
    throw error
  }
  return productId
}

export async function replyToReview(storeId: string, reviewId: string, reply: string) {
  const updated = await prisma.review.updateMany({ where: { id: reviewId, storeId, sellerReply: null }, data: { sellerReply: reply, sellerRepliedAt: new Date() } })
  if (updated.count !== 1) throw new ReviewError("You've already replied to this review.")
}

export async function setReviewVisibility(reviewId: string, hidden: boolean, reason: string | null) {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { productId: true } })
  if (!review) throw new ReviewError("Review not found.")
  await prisma.$transaction(async (tx) => {
    await tx.review.update({ where: { id: reviewId }, data: hidden ? { status: "hidden", hiddenReason: reason } : { status: "visible", hiddenReason: null } })
    await refreshRating(tx, review.productId)
  })
  return review.productId
}
