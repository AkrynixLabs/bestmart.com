import "server-only"
import { headers } from "next/headers"

import { isE2ETestMode, isProduction } from "@/lib/env"
import { appUrl } from "@/lib/site"

/** Best-effort client IP (Vercel sets x-forwarded-for; first entry is the client). */
export function clientIpFrom(get: (name: string) => string | null): string {
  const forwarded = get("x-forwarded-for")
  const first = forwarded?.split(",")[0]?.trim()
  return first || get("x-real-ip") || "unknown"
}

export async function clientIp(): Promise<string> {
  const h = await headers()
  return clientIpFrom((name) => h.get(name))
}

/**
 * The site's origin for absolute links sent to third parties (e.g. the
 * payment callback). Production always uses the configured URL (never a
 * client-supplied Host header); development and e2e use the request's host,
 * so whatever port the server runs on works.
 */
export async function siteOrigin(): Promise<string> {
  if (isProduction() && !isE2ETestMode()) return appUrl()
  const h = await headers()
  const host = h.get("host")
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return appUrl()
  return `${h.get("x-forwarded-proto") === "https" ? "https" : "http"}://${host}`
}
