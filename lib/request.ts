import "server-only"
import { headers } from "next/headers"

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
