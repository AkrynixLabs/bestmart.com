"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { echoValues, type FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { ADMIN_ROLES, actionUser } from "@/lib/auth/session"
import { sendEmail } from "@/lib/email/send"
import { productBlockedMessage } from "@/lib/email/templates"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { blockProductSchema } from "@/lib/validation/catalog"
import { fieldErrors } from "@/lib/validation/common"

const NOT_ALLOWED: FormState = { error: "You don't have permission to do that." }

export async function blockProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return NOT_ALLOWED
  const values = echoValues(formData)
  const parsed = blockProductSchema.safeParse(values)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }
  const ip = await clientIp()

  const product = await prisma.$transaction(async (tx) => {
    const claimed = await tx.product.updateMany({
      where: { id: parsed.data.productId, blockedAt: null },
      data: { blockedAt: new Date(), blockedReason: parsed.data.reason, blockedById: admin.id },
    })
    if (claimed.count !== 1) return null
    await audit({ actorId: admin.id, action: "product.blocked", entityType: "product", entityId: parsed.data.productId, metadata: { reason: parsed.data.reason }, ip }, tx)
    return tx.product.findUniqueOrThrow({ where: { id: parsed.data.productId }, include: { store: { include: { user: { select: { email: true, name: true } } } } } })
  })
  if (!product) return { error: "This product is already blocked (or no longer exists)." }

  revalidatePath("/admin/products")
  revalidatePath(`/p/${product.slug}`)
  try {
    await sendEmail({ to: product.store.user.email, ...productBlockedMessage(product.store.user.name, product.title, parsed.data.reason, product.id) })
  } catch (error) {
    logger.error("product blocked email failed", { productId: product.id, error: error instanceof Error ? error.message : String(error) })
  }
  // The product may leave the current list, so confirm at page level.
  redirect("/admin/products?view=blocked&done=blocked")
}

export async function unblockProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return NOT_ALLOWED
  const productId = String(formData.get("productId") ?? "")
  const ip = await clientIp()
  const product = await prisma.$transaction(async (tx) => {
    const claimed = await tx.product.updateMany({ where: { id: productId, blockedAt: { not: null } }, data: { blockedAt: null, blockedReason: null, blockedById: null } })
    if (claimed.count !== 1) return null
    await audit({ actorId: admin.id, action: "product.unblocked", entityType: "product", entityId: productId, ip }, tx)
    return tx.product.findUniqueOrThrow({ where: { id: productId }, select: { slug: true } })
  })
  if (!product) return { error: "This product isn't blocked." }
  revalidatePath("/admin/products")
  revalidatePath(`/p/${product.slug}`)
  redirect("/admin/products?done=unblocked")
}
