import { releaseExpiredReservations } from "@/lib/checkout/orders"
import { cronAuthorised } from "@/lib/cron"

// Backstop for expired stock reservations (they're also released whenever
// someone checks out or views a cart or order). Vercel Cron calls it with
// "Authorization: Bearer <CRON_SECRET>". The daily schedule runs
// /api/cron/daily (which includes this); this route is kept for tests.

export async function GET(request: Request) {
  if (!cronAuthorised(request)) return new Response("Unauthorized", { status: 401 })
  const released = await releaseExpiredReservations(500)
  return Response.json({ released }, { headers: { "Cache-Control": "no-store" } })
}
