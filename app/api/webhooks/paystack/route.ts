import { Prisma } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import { paymentProvider } from "@/lib/payments"
import { webhookDedupeKey } from "@/lib/payments/rules"
import { handlePaymentEvent } from "@/lib/payments/service"
import { prisma } from "@/lib/prisma"

// Paystack webhooks. Order of checks:
//   1. signature (HMAC-SHA512 of the raw body) or 401;
//   2. record the event under a unique key; an already-processed duplicate is a no-op;
//   3. process it. Payments are re-verified with Paystack's API inside
//      confirmPayment, never taken from the webhook body alone.
// A processing error returns 500 so Paystack retries; the stored event is
// reprocessed on the retry because it has no processedAt yet.

export async function POST(request: Request) {
  const raw = await request.text()
  if (raw.length > 1_000_000) return new Response("Payload too large", { status: 413 })
  if (!paymentProvider().verifySignature(raw, request.headers.get("x-paystack-signature"))) {
    logger.warn("paystack webhook with a bad signature")
    return new Response("Invalid signature", { status: 401 })
  }

  let body: { event?: unknown; data?: unknown }
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }
  const event = typeof body.event === "string" ? body.event : ""
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {}
  const dedupeKey = webhookDedupeKey(event, data)
  if (!event || !dedupeKey) return Response.json({ ignored: true })

  let record = await prisma.webhookEvent.findUnique({ where: { provider_dedupeKey: { provider: "paystack", dedupeKey } } })
  if (record?.processedAt) return Response.json({ duplicate: true })
  if (!record) {
    try {
      record = await prisma.webhookEvent.create({ data: { provider: "paystack", dedupeKey, eventType: event, payload: body as Prisma.InputJsonValue } })
    } catch (error) {
      // A concurrent delivery of the same event got there first.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ duplicate: true })
      throw error
    }
  }

  try {
    await handlePaymentEvent(event, data)
    await prisma.webhookEvent.update({ where: { id: record.id }, data: { processedAt: new Date(), error: null } })
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error("paystack webhook processing failed", { event, dedupeKey, error: message })
    await prisma.webhookEvent.update({ where: { id: record.id }, data: { error: message.slice(0, 1000) } })
    return new Response("Processing failed", { status: 500 })
  }
}
