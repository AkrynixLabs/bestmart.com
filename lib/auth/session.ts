import "server-only"
import { cache } from "react"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import type { Role } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

import { twoFactorVerified } from "./two-factor"

export const ADMIN_ROLES: readonly Role[] = ["ops_admin", "super_admin"]

/**
 * The signed-in user, freshly read from the database (once per request).
 * Returns null when signed out, or when the account no longer exists or is
 * suspended, so a stale session cookie never grants access.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, phone: true, role: true, status: true, emailVerifiedAt: true, passwordHash: true, googleId: true, totpEnabledAt: true },
  })
  if (!user || user.status !== "active") return null
  const { passwordHash, ...rest } = user
  return { ...rest, hasPassword: Boolean(passwordHash) }
})

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

/** For pages: redirects to login (then back) when signed out. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`)
  return user
}

/** Admin-only access also needs a recent two-factor check (set up first if needed). */
async function needsTwoFactor(user: CurrentUser, roles: readonly Role[]): Promise<boolean> {
  const adminAccess = roles.some((r) => ADMIN_ROLES.includes(r)) && isAdmin(user.role)
  if (!adminAccess) return false
  return !user.totpEnabledAt || !(await twoFactorVerified(user.id))
}

/**
 * For pages: signed in AND one of the roles, otherwise 404 (don't reveal
 * admin URLs). Admins are sent to two-factor setup/verification first.
 */
export async function requireRole(roles: readonly Role[], returnTo: string): Promise<CurrentUser> {
  const user = await requireUser(returnTo)
  if (!roles.includes(user.role)) {
    notFound()
  }
  if (await needsTwoFactor(user, roles)) redirect(`/account/two-factor?next=${encodeURIComponent(returnTo)}`)
  return user
}

/** For Server Actions: returns the user or null; callers return an { error }. Admin roles also need two-factor. */
export async function actionUser(roles?: readonly Role[]): Promise<CurrentUser | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (roles && !roles.includes(user.role)) return null
  if (roles && (await needsTwoFactor(user, roles))) return null
  return user
}

/** For route handlers serving admin-only data (files, exports): the admin, or null. */
export async function routeAdmin(roles: readonly Role[] = ADMIN_ROLES): Promise<CurrentUser | null> {
  return actionUser(roles)
}

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role)
}
