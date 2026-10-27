"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { signOut } from "@/auth"
import { echoValues, type FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { actionUser } from "@/lib/auth/session"
import { sendEmail } from "@/lib/email/send"
import { passwordChangedMessage } from "@/lib/email/templates"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"
import { clientIp } from "@/lib/request"
import { addressSchema } from "@/lib/validation/address"
import { changePasswordSchema, profileSchema } from "@/lib/validation/auth"
import { fieldErrors } from "@/lib/validation/common"

const SIGNED_OUT: FormState = { error: "Your session has ended. Please sign in again." }
const MAX_ADDRESSES = 10

export async function signOutAction() {
  await signOut({ redirectTo: "/" })
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return SIGNED_OUT
  const values = echoValues(formData)
  const parsed = profileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone ?? null } })
  revalidatePath("/account")
  return { success: "Your details have been saved." }
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return SIGNED_OUT
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }

  const { allowed } = await checkRateLimit("change-password", user.id)
  if (!allowed) return { error: "Too many attempts. Please wait a while and try again." }

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } })
  // Google-only accounts have no password yet and may set one directly.
  if (row.passwordHash) {
    if (!parsed.data.currentPassword || !(await verifyPassword(parsed.data.currentPassword, row.passwordHash))) {
      return { fieldErrors: { currentPassword: "Your current password is incorrect" } }
    }
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } })
  await audit({ actorId: user.id, action: "user.password_changed", entityType: "user", entityId: user.id, ip: await clientIp() })
  sendEmail({ to: user.email, ...passwordChangedMessage(user.name) }).catch((error) => logger.error("password-changed email failed", { error }))
  return { success: row.passwordHash ? "Your password has been changed." : "Your password has been set. You can now also sign in with your email." }
}

export async function saveAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return SIGNED_OUT
  const values = echoValues(formData)
  const parsed = addressSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }
  const addressId = formData.get("addressId")
  const { isDefault, ...data } = parsed.data

  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId: user.id } })
    if (typeof addressId === "string" && addressId) {
      // Ownership is part of the WHERE clause, so another user's id matches nothing.
      const existing = await tx.address.findFirst({ where: { id: addressId, userId: user.id }, select: { id: true } })
      if (!existing) return "not_found" as const
      if (isDefault) await tx.address.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } })
      await tx.address.update({ where: { id: existing.id }, data: { ...data, ...(isDefault ? { isDefault: true } : {}) } })
      return "ok" as const
    }
    if (count >= MAX_ADDRESSES) return "limit" as const
    const makeDefault = isDefault || count === 0
    if (makeDefault) await tx.address.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } })
    await tx.address.create({ data: { ...data, userId: user.id, isDefault: makeDefault } })
    return "ok" as const
  })

  if (result === "not_found") return { error: "That address no longer exists.", values }
  if (result === "limit") return { error: `You can save up to ${MAX_ADDRESSES} addresses. Remove one first.`, values }
  revalidatePath("/account/addresses")
  redirect("/account/addresses?saved=1")
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await actionUser()
  if (!user) return
  const id = formData.get("addressId")
  if (typeof id !== "string") return
  await prisma.$transaction(async (tx) => {
    const removed = await tx.address.deleteMany({ where: { id, userId: user.id } })
    if (removed.count === 0) return
    // Keep exactly one default if any addresses remain.
    const hasDefault = await tx.address.count({ where: { userId: user.id, isDefault: true } })
    if (!hasDefault) {
      const next = await tx.address.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true } })
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } })
    }
  })
  revalidatePath("/account/addresses")
}

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const user = await actionUser()
  if (!user) return
  const id = formData.get("addressId")
  if (typeof id !== "string") return
  await prisma.$transaction(async (tx) => {
    const target = await tx.address.findFirst({ where: { id, userId: user.id }, select: { id: true } })
    if (!target) return
    await tx.address.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } })
    await tx.address.update({ where: { id: target.id }, data: { isDefault: true } })
  })
  revalidatePath("/account/addresses")
}
