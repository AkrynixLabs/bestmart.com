import "server-only"
import { cache } from "react"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import type { Role } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

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
    select: { id: true, email: true, name: true, phone: true, role: true, status: true, emailVerifiedAt: true, passwordHash: true, googleId: true },
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

/** For pages: signed in AND one of the roles, otherwise 404 (don't reveal admin URLs). */
export async function requireRole(roles: readonly Role[], returnTo: string): Promise<CurrentUser> {
  const user = await requireUser(returnTo)
  if (!roles.includes(user.role)) {
    notFound()
  }
  return user
}

/** For Server Actions: returns the user or null; callers return an { error }. */
export async function actionUser(roles?: readonly Role[]): Promise<CurrentUser | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (roles && !roles.includes(user.role)) return null
  return user
}

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role)
}
