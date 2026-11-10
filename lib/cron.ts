import "server-only"
import { timingSafeEqual } from "node:crypto"

import { allowDevFallbacks, env } from "@/lib/env"

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Without a secret, only allowed outside production. */
export function cronAuthorised(request: Request): boolean {
  const secret = env().CRON_SECRET
  if (!secret) return allowDevFallbacks()
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
