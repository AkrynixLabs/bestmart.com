"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { ADMIN_ROLES, actionUser } from "@/lib/auth/session"
import { sendEmail } from "@/lib/email/send"
import { applicationApprovedMessage, applicationRejectedMessage } from "@/lib/email/templates"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { slugify } from "@/lib/slug"
import { fieldErrors } from "@/lib/validation/common"
import { rejectApplicationSchema } from "@/lib/validation/seller"

const NOT_ALLOWED: FormState = { error: "You don't have permission to do that." }

export async function approveApplicationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return NOT_ALLOWED
  const applicationId = formData.get("applicationId")
  if (typeof applicationId !== "string") return { error: "Missing application." }
  const ip = await clientIp()

  const outcome = await prisma.$transaction(async (tx) => {
    // Conditional update: only one reviewer can move it out of "pending".
    const claimed = await tx.sellerApplication.updateMany({
      where: { id: applicationId, status: "pending" },
      data: { status: "approved", reviewedById: admin.id, reviewedAt: new Date() },
    })
    if (claimed.count !== 1) return { error: "This application was already reviewed." } as const

    const app = await tx.sellerApplication.findUniqueOrThrow({ where: { id: applicationId }, include: { user: true } })
    if (app.user.status !== "active" || app.user.role !== "customer") {
      throw new ApprovalBlocked("The applicant's account is suspended or is no longer a customer account.")
    }

    const base = slugify(app.storeName)
    const taken = await tx.store.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })
    const takenSet = new Set(taken.map((s) => s.slug))
    let slug = base
    for (let n = 2; takenSet.has(slug); n++) slug = `${base}-${n}`

    const store = await tx.store.create({
      data: {
        userId: app.userId,
        applicationId: app.id,
        slug,
        name: app.storeName,
        phone: app.phone,
        region: app.region,
        city: app.city,
        payoutMethod: app.payoutMethod,
        payoutProvider: app.payoutProvider,
        payoutAccountName: app.payoutAccountName,
        payoutAccountNumber: app.payoutAccountNumber,
      },
    })
    await tx.user.update({ where: { id: app.userId }, data: { role: "seller" } })
    await audit({ actorId: admin.id, action: "seller_application.approved", entityType: "seller_application", entityId: app.id, metadata: { storeId: store.id, slug }, ip }, tx)
    return { app } as const
  }).catch((error: unknown) => {
    if (error instanceof ApprovalBlocked) return { error: error.message } as const
    throw error
  })

  if ("error" in outcome) return { error: outcome.error }
  sendEmail({ to: outcome.app.user.email, ...applicationApprovedMessage(outcome.app.user.name, outcome.app.storeName) }).catch((error) =>
    logger.error("approval email failed", { error })
  )
  revalidatePath("/admin/seller-applications")
  redirect(`/admin/seller-applications/${applicationId}?done=approved`)
}

export async function rejectApplicationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return NOT_ALLOWED
  const parsed = rejectApplicationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: { reason: String(formData.get("reason") ?? "") } }
  const { applicationId, reason } = parsed.data
  const ip = await clientIp()

  const app = await prisma.$transaction(async (tx) => {
    const claimed = await tx.sellerApplication.updateMany({
      where: { id: applicationId, status: "pending" },
      data: { status: "rejected", rejectionReason: reason, reviewedById: admin.id, reviewedAt: new Date() },
    })
    if (claimed.count !== 1) return null
    await audit({ actorId: admin.id, action: "seller_application.rejected", entityType: "seller_application", entityId: applicationId, metadata: { reason }, ip }, tx)
    return tx.sellerApplication.findUniqueOrThrow({ where: { id: applicationId }, include: { user: { select: { email: true, name: true } } } })
  })
  if (!app) return { error: "This application was already reviewed." }

  sendEmail({ to: app.user.email, ...applicationRejectedMessage(app.user.name, app.storeName, reason) }).catch((error) =>
    logger.error("rejection email failed", { error })
  )
  revalidatePath("/admin/seller-applications")
  redirect(`/admin/seller-applications/${applicationId}?done=rejected`)
}

class ApprovalBlocked extends Error {}
