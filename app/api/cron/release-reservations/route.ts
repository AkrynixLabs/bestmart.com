import { timingSafeEqual } from "node:crypto"

import { releaseExpiredReservations } from "@/lib/checkout/orders"
import { allowDevFallbacks, env } from "@/lib/env"

// Backstop for expired stock reservations (they're also released whenever
// someone checks out or views a cart or order). Vercel Cron calls it with
// "Authorization: Bearer <CRON_SECRET>"; see vercel.json for the schedule.

function authorised(request: Request): boolean {
  const secret = env().CRON_SECRET
  if (!secret) return allowDevFallbacks()
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  if (!authorised(request)) return new Response("Unauthorized", { status: 401 })
  const released = await releaseExpiredReservations(500)
  return Response.json({ released }, { headers: { "Cache-Control": "no-store" } })
}
