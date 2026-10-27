import "server-only"
import { randomBytes } from "node:crypto"

import type { AuthTokenPurpose } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

import { hashToken } from "./token-hash"

const TTL_MS: Record<AuthTokenPurpose, number> = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
}

/**
 * Issues a new single-use token and invalidates any earlier unused ones for
 * the same purpose, so only the most recent link works. Returns the raw token
 * (to put in the emailed link); only its hash is stored.
 */
export async function issueToken(userId: string, purpose: AuthTokenPurpose): Promise<string> {
  const raw = randomBytes(32).toString("base64url")
  const now = new Date()
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } }),
    prisma.authToken.create({
      data: { userId, purpose, tokenHash: hashToken(raw), expiresAt: new Date(now.getTime() + TTL_MS[purpose]) },
    }),
  ])
  return raw
}

/** Looks a token up without using it (e.g. to decide whether to show the reset form). */
export async function peekToken(raw: string, purpose: AuthTokenPurpose) {
  const token = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(raw) } })
  if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt <= new Date()) return null
  return token
}

/**
 * Atomically marks a valid token as used and returns its user id, or null if
 * the token is unknown, expired, already used or for another purpose. Safe
 * against double submission: only one caller can win the conditional update.
 */
export async function consumeToken(raw: string, purpose: AuthTokenPurpose): Promise<string | null> {
  const tokenHash = hashToken(raw)
  const now = new Date()
  const { count } = await prisma.authToken.updateMany({
    where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  })
  if (count !== 1) return null
  const token = await prisma.authToken.findUnique({ where: { tokenHash }, select: { userId: true } })
  return token?.userId ?? null
}
