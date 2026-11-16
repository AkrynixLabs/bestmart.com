"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { ADMIN_ROLES, actionUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { ReviewError, setReviewVisibility } from "@/lib/reviews/service"
import { requiredText } from "@/lib/validation/common"

export async function setReviewVisibilityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return { error: "You don't have permission to do that." }
  const reviewId = String(formData.get("reviewId") ?? "")
  const hide = formData.get("hide") === "true"
  const reason = requiredText("Reason", 300).safeParse(formData.get("reason") ?? "")
  if (hide && !reason.success) return { fieldErrors: { reason: "Give a reason" } }
  try {
    const productId = await setReviewVisibility(reviewId, hide, hide && reason.success ? reason.data : null)
    const slug = (await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } }))?.slug
    if (slug) revalidatePath(`/p/${slug}`)
  } catch (error) {
    if (error instanceof ReviewError) return { error: error.message }
    throw error
  }
  await audit({ actorId: admin.id, action: hide ? "review.hidden" : "review.restored", entityType: "review", entityId: reviewId, metadata: hide && reason.success ? { reason: reason.data } : undefined, ip: await clientIp() })
  revalidatePath("/admin/reviews")
  // The review leaves the list it was in, so confirm at page level.
  redirect(`/admin/reviews?${hide ? "view=hidden&" : ""}done=${hide ? "hidden" : "restored"}`)
}
