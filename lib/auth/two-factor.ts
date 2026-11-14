import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"

import { env, isProduction } from "@/lib/env"
import { prisma } from "@/lib/prisma"

import { decrypt, encrypt, signToken, verifyToken } from "./secret-box"
import { generateTotpSecret, verifyTotp } from "./totp"

// Two-factor sign-in for admins. After the password, an admin proves they
// hold their authenticator (or a recovery code); a signed, httpOnly cookie
// bound to their user id then marks the browser as verified for 12 hours.
// The cookie is cleared on every new sign-in, so it never outlives a session.

export const TWO_FACTOR_COOKIE = "bm_2fa"
const TTL_MS = 12 * 60 * 60 * 1000
const SECRET_PURPOSE = "totp-secret"
const COOKIE_PURPOSE = "two-factor-cookie"
const RECOVERY_CODES = 8

const appSecret = () => env().AUTH_SECRET
const hashCode = (code: string) => createHash("sha256").update(code.replace(/[\s-]/g, "").toUpperCase()).digest("hex")

/** Whether this browser has passed two-factor for this user recently. */
export async function twoFactorVerified(userId: string): Promise<boolean> {
  const token = (await cookies()).get(TWO_FACTOR_COOKIE)?.value
  if (!token) return false
  const payload = verifyToken(token, appSecret(), COOKIE_PURPOSE)
  if (!payload) return false
  const [id, expires] = payload.split(".")
  return id === userId && Number(expires) > Date.now()
}

async function markVerified(userId: string) {
  const token = signToken(`${userId}.${Date.now() + TTL_MS}`, appSecret(), COOKIE_PURPOSE)
  ;(await cookies()).set(TWO_FACTOR_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/", maxAge: TTL_MS / 1000 })
}

/** Call on every sign-in and sign-out. */
export async function clearTwoFactorCookie() {
  ;(await cookies()).delete(TWO_FACTOR_COOKIE)
}

/** Starts (or restarts) setup: a fresh secret, stored encrypted, not yet active. */
export async function beginSetup(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpEnabledAt: true } })
  if (user.totpEnabledAt) throw new Error("Two-factor is already set up")
  const secret = generateTotpSecret()
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: encrypt(secret, appSecret(), SECRET_PURPOSE), totpLastStep: null } })
  return secret
}

/** The pending secret during setup (to show again after a wrong code). */
export async function pendingSecret(userId: string): Promise<string | null> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpSecret: true, totpEnabledAt: true } })
  if (user.totpEnabledAt || !user.totpSecret) return null
  return decrypt(user.totpSecret, appSecret(), SECRET_PURPOSE)
}

/** Finishes setup with a first code; returns the recovery codes (shown once). */
export async function confirmSetup(userId: string, code: string): Promise<string[] | null> {
  const secret = await pendingSecret(userId)
  if (!secret) return null
  const step = verifyTotp(secret, code)
  if (step === null) return null
  const codes = Array.from({ length: RECOVERY_CODES }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase()
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
  const enabled = await prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({ where: { id: userId, totpEnabledAt: null }, data: { totpEnabledAt: new Date(), totpLastStep: step } })
    if (claimed.count !== 1) return false
    await tx.recoveryCode.deleteMany({ where: { userId } })
    await tx.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashCode(c) })) })
    return true
  })
  if (!enabled) return null
  await markVerified(userId)
  return codes
}

/** Verifies a 6-digit code (never the same one twice) or an unused recovery code. */
export async function verifySecondFactor(userId: string, input: string): Promise<"ok" | "invalid"> {
  const code = input.trim()
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpSecret: true, totpEnabledAt: true, totpLastStep: true } })
  if (!user.totpEnabledAt || !user.totpSecret) return "invalid"
  if (/^\d{6}$/.test(code.replace(/\s/g, ""))) {
    const step = verifyTotp(decrypt(user.totpSecret, appSecret(), SECRET_PURPOSE), code)
    if (step === null) return "invalid"
    // Conditional update: a code (step) already used can't be used again.
    const claimed = await prisma.user.updateMany({ where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } })
    if (claimed.count !== 1) return "invalid"
  } else {
    const used = await prisma.recoveryCode.updateMany({ where: { userId, codeHash: hashCode(code), usedAt: null }, data: { usedAt: new Date() } })
    if (used.count !== 1) return "invalid"
  }
  await markVerified(userId)
  return "ok"
}

export async function remainingRecoveryCodes(userId: string): Promise<number> {
  return prisma.recoveryCode.count({ where: { userId, usedAt: null } })
}

/** Super Admin action when an admin loses their phone: they set it up again on next visit. */
export async function resetTwoFactor(userId: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } }),
    prisma.recoveryCode.deleteMany({ where: { userId } }),
  ])
}

/** Two-factor was switched on in the last few minutes and this browser is verified (the setup page keeps showing recovery codes). */
export async function justEnabledHere(user: { id: string; totpEnabledAt: Date | null }): Promise<boolean> {
  return Boolean(user.totpEnabledAt && Date.now() - user.totpEnabledAt.getTime() < 10 * 60 * 1000 && (await twoFactorVerified(user.id)))
}
