"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"

import { echoValues, type FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { actionUser } from "@/lib/auth/session"
import { sendEmail } from "@/lib/email/send"
import { applicationReceivedMessage } from "@/lib/email/templates"
import { Prisma } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"
import { clientIp } from "@/lib/request"
import { putPrivate } from "@/lib/storage"
import { fieldErrors } from "@/lib/validation/common"
import { KYC_MAX_BYTES, sellerApplicationSchema, sniffKycType } from "@/lib/validation/seller"

const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as const

export async function submitSellerApplicationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return { error: "Your session has ended. Please sign in again." }
  const values = echoValues(formData)

  if (user.role !== "customer") {
    return { error: user.role === "seller" ? "You're already a seller." : "Admin accounts can't apply to sell. Use a separate customer account." }
  }
  if (!user.emailVerifiedAt) return { error: "Confirm your email address before applying." }

  const parsed = sellerApplicationSchema.safeParse(Object.fromEntries(formData))
  const file = formData.get("ghanaCardImage")
  const errors = parsed.success ? {} : fieldErrors(parsed.error)

  let bytes: Uint8Array | null = null
  let contentType: keyof typeof EXTENSION | null = null
  if (!(file instanceof File) || file.size === 0) {
    errors.ghanaCardImage = "Upload a clear photo or scan of your Ghana Card"
  } else if (file.size > KYC_MAX_BYTES) {
    errors.ghanaCardImage = "The file must be 5 MB or smaller"
  } else {
    bytes = new Uint8Array(await file.arrayBuffer())
    contentType = sniffKycType(bytes)
    if (!contentType) errors.ghanaCardImage = "Upload a JPG, PNG, WebP or PDF file"
  }
  if (!parsed.success || Object.keys(errors).length > 0 || !bytes || !contentType) {
    return { fieldErrors: errors, values }
  }

  const { allowed } = await checkRateLimit("seller-application", user.id)
  if (!allowed) return { error: "You've submitted too many applications today. Please try again tomorrow.", values }

  const pending = await prisma.sellerApplication.findFirst({ where: { userId: user.id, status: "pending" }, select: { id: true } })
  if (pending) return { error: "You already have an application under review." }

  const { agreeToSellerTerms: _agreed, ...data } = parsed.data
  try {
    const key = await putPrivate(`kyc/${user.id}/${randomUUID()}.${EXTENSION[contentType]}`, bytes, contentType)
    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.sellerApplication.create({ data: { ...data, ghanaCardImageKey: key, userId: user.id } })
      await audit(
        { actorId: user.id, action: "seller_application.submitted", entityType: "seller_application", entityId: created.id, ip: await clientIp() },
        tx
      )
      return created
    })
    sendEmail({ to: user.email, ...applicationReceivedMessage(user.name, application.storeName) }).catch((error) =>
      logger.error("application-received email failed", { error })
    )
  } catch (error) {
    // The partial unique index stops a double submit creating two pending applications.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "You already have an application under review." }
    }
    logger.error("seller application failed", { error, userId: user.id })
    return { error: "We couldn't submit your application right now. Please try again.", values }
  }
  revalidatePath("/sell/apply")
  return { success: "submitted" }
}
