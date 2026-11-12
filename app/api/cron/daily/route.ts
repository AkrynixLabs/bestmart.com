import { releaseExpiredReservations } from "@/lib/checkout/orders"
import { cronAuthorised } from "@/lib/cron"
import { runFulfilmentJobs } from "@/lib/fulfilment/service"
import { logger } from "@/lib/logger"
import { maybePrepareWeeklyBatch } from "@/lib/payouts/service"

// Every time-based job, in order: release expired stock holds, auto-confirm
// deliveries, release held earnings, tell buyers about late shipments,
// send queued emails, and draft the weekly payout batch on the payout day. Scheduled in vercel.json; each job is also triggered
// by normal traffic, so a daily run (Vercel Hobby's limit) is only a backstop.
export async function GET(request: Request) {
  if (!cronAuthorised(request)) return new Response("Unauthorized", { status: 401 })
  const reservations = await releaseExpiredReservations(500)
  const fulfilment = await runFulfilmentJobs()
  const payoutBatchPrepared = await maybePrepareWeeklyBatch()
  logger.info("daily jobs", { reservations, ...fulfilment, payoutBatchPrepared })
  return Response.json({ reservations, ...fulfilment, payoutBatchPrepared }, { headers: { "Cache-Control": "no-store" } })
}
