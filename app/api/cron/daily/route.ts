import { releaseExpiredReservations } from "@/lib/checkout/orders"
import { cronAuthorised } from "@/lib/cron"
import { runFulfilmentJobs } from "@/lib/fulfilment/service"
import { logger } from "@/lib/logger"

// Every time-based job, in order: release expired stock holds, auto-confirm
// deliveries, release held earnings, tell buyers about late shipments, and
// send queued emails. Scheduled in vercel.json; each job is also triggered
// by normal traffic, so a daily run (Vercel Hobby's limit) is only a backstop.
export async function GET(request: Request) {
  if (!cronAuthorised(request)) return new Response("Unauthorized", { status: 401 })
  const reservations = await releaseExpiredReservations(500)
  const fulfilment = await runFulfilmentJobs()
  logger.info("daily jobs", { reservations, ...fulfilment })
  return Response.json({ reservations, ...fulfilment }, { headers: { "Cache-Control": "no-store" } })
}
