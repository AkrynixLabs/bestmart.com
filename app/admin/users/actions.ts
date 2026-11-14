"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { ADMIN_ROLES, actionUser, isAdmin } from "@/lib/auth/session"
import { resetTwoFactor } from "@/lib/auth/two-factor"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { requiredText } from "@/lib/validation/common"

// Ops admins can suspend and reinstate customers, sellers and stores.
// Only the Super Admin touches admin accounts (roles, suspension, 2FA reset).
// Nobody can act on themselves. Every change is audit-logged.

async function target(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { store: { select: { id: true, status: true } } } })
}

function done(id: string, what: string): never {
  revalidatePath(`/admin/users/${id}`)
  revalidatePath("/admin/users")
  redirect(`/admin/users/${id}?done=${what}`)
}

export async function setUserStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return { error: "You don't have permission to do that." }
  const id = String(formData.get("userId") ?? "")
  const status = formData.get("status") === "suspended" ? "suspended" : "active"
  const user = await target(id)
  if (!user) return { error: "That account no longer exists." }
  if (user.id === admin.id) return { error: "You can't change your own account here." }
  if (isAdmin(user.role) && admin.role !== "super_admin") return { error: "Only the Super Admin can suspend admin accounts." }
  if (user.role === "super_admin") return { error: "The Super Admin account can't be suspended here." }
  const reason = requiredText("Reason", 300).safeParse(formData.get("reason") ?? "")
  if (status === "suspended" && !reason.success) return { fieldErrors: { reason: "Give a reason (kept in the audit log)" } }
  await prisma.user.update({ where: { id }, data: { status } })
  await audit({ actorId: admin.id, action: status === "suspended" ? "user.suspended" : "user.reinstated", entityType: "user", entityId: id, metadata: reason.success ? { reason: reason.data } : undefined, ip: await clientIp() })
  done(id, status === "suspended" ? "suspended" : "reinstated")
}

export async function setStoreStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return { error: "You don't have permission to do that." }
  const id = String(formData.get("userId") ?? "")
  const status = formData.get("status") === "suspended" ? "suspended" : "active"
  const user = await target(id)
  if (!user?.store) return { error: "That store no longer exists." }
  const reason = requiredText("Reason", 300).safeParse(formData.get("reason") ?? "")
  if (status === "suspended" && !reason.success) return { fieldErrors: { reason: "Give a reason (kept in the audit log)" } }
  await prisma.store.update({ where: { id: user.store.id }, data: { status } })
  await audit({ actorId: admin.id, action: status === "suspended" ? "store.suspended" : "store.reinstated", entityType: "store", entityId: user.store.id, metadata: reason.success ? { reason: reason.data } : undefined, ip: await clientIp() })
  revalidatePath("/", "layout")
  done(id, status === "suspended" ? "store_suspended" : "store_reinstated")
}

export async function setRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(["super_admin"])
  if (!admin) return { error: "Only the Super Admin can change roles." }
  const id = String(formData.get("userId") ?? "")
  const role = formData.get("role") === "ops_admin" ? "ops_admin" : "customer"
  const user = await target(id)
  if (!user) return { error: "That account no longer exists." }
  if (user.id === admin.id) return { error: "You can't change your own role." }
  if (user.role === "seller" || user.role === "super_admin") return { error: "Sellers and the Super Admin can't be changed here." }
  if (user.role === role) return { error: "Nothing to change." }
  if (role === "ops_admin" && (!user.emailVerifiedAt || user.status !== "active")) return { error: "Only active, verified accounts can become admins." }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { role } })
    // A demoted admin loses their two-factor setup; a new admin sets it up on first visit.
    if (role === "customer") {
      await tx.user.update({ where: { id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } })
      await tx.recoveryCode.deleteMany({ where: { userId: id } })
    }
    await audit({ actorId: admin.id, action: "user.role_changed", entityType: "user", entityId: id, metadata: { from: user.role, to: role }, ip: await clientIp() }, tx)
  })
  done(id, role === "ops_admin" ? "promoted" : "demoted")
}

export async function resetTwoFactorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(["super_admin"])
  if (!admin) return { error: "Only the Super Admin can reset two-factor sign-in." }
  const id = String(formData.get("userId") ?? "")
  const user = await target(id)
  if (!user || !isAdmin(user.role)) return { error: "Only admin accounts use two-factor sign-in." }
  if (user.id === admin.id) return { error: "You can't reset your own two-factor here." }
  await resetTwoFactor(id)
  await audit({ actorId: admin.id, action: "user.two_factor_reset", entityType: "user", entityId: id, ip: await clientIp() })
  done(id, "2fa_reset")
}
