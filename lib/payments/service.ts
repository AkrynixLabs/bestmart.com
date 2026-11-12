import "server-only"

import { syncProductAggregates } from "@/lib/catalog/products"
import { sendEmail } from "@/lib/email/send"
import { newOrderMessage, paymentReceivedMessage, refundIssuedMessage } from "@/lib/email/templates"
import { Prisma } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

import { paymentProvider } from "./index"
import { paymentReference, refundEntries, saleEntries, splitRefund, subOrderCommission } from "./rules"

// The money flow. Every state change claims its row with a conditional
// update first, so a webhook, the browser's return trip and the expiry job
// can race without double-counting:
//   - an order goes awaiting_payment -> paid exactly once (or -> expired);
//   - a payment goes -> succeeded at most once per order (partial unique index);
//   - a refund reserves its amount on the sub-order before calling the provider.

export class PaymentError extends Error {}

async function notify(email: { to: string; subject: string; html: string; text: string }) {
  try {
    await sendEmail(email)
  } catch (error) {
    logger.error("payment email failed", { to: email.to, error: error instanceof Error ? error.message : String(error) })
  }
}

// ---------------------------------------------------------------------------
// Starting a payment
// ---------------------------------------------------------------------------

export async function startPayment({ userId, email, orderNumber, origin }: { userId: string; email: string; orderNumber: string; origin: string }): Promise<string> {
  const order = await prisma.order.findFirst({ where: { number: orderNumber, userId }, include: { _count: { select: { payments: true } } } })
  if (!order) throw new PaymentError("Order not found.")
  if (order.status !== "awaiting_payment") throw new PaymentError(order.status === "paid" ? "This order is already paid." : "This order can no longer be paid.")
  if (order.reservedUntil <= new Date()) throw new PaymentError("The time to pay for this order has run out. Please check out again.")

  const reference = paymentReference(order.number, order._count.payments + 1)
  const payment = await prisma.payment.create({ data: { orderId: order.id, provider: paymentProvider().name, reference, amount: order.grandTotal } })
  try {
    const { authorizationUrl } = await paymentProvider().initialize({
      reference,
      amount: order.grandTotal,
      email,
      callbackUrl: `${origin}/orders/${order.number}/payment?reference=${encodeURIComponent(reference)}`,
      metadata: { orderNumber: order.number, orderId: order.id },
    })
    return authorizationUrl
  } catch (error) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed", failureReason: "Could not start the payment" } })
    logger.error("payment initialize failed", { reference, error: error instanceof Error ? error.message : String(error) })
    throw new PaymentError("We couldn't reach the payment service. Please try again in a moment.")
  }
}

// ---------------------------------------------------------------------------
// Confirming a payment (webhook or the buyer's return trip; idempotent)
// ---------------------------------------------------------------------------

export type ConfirmOutcome = "paid" | "pending" | "failed" | "refunded" | "unknown"

/** Marks a sub-order paid and writes the seller's pending ledger entries. */
async function markSubOrdersPaid(tx: Prisma.TransactionClient, orderId: string, paidAt: Date) {
  const { shipWithinDays } = await getPlatformSettings()
  const subs = await tx.subOrder.findMany({ where: { orderId }, include: { items: { select: { lineTotal: true, commissionBps: true } } } })
  for (const sub of subs) {
    const commissionTotal = subOrderCommission(sub.items)
    // The shipping deadline counts from payment (the seller can't ship before it).
    const shipBy = new Date(Math.max(paidAt.getTime(), Date.now()) + shipWithinDays * 24 * 60 * 60 * 1000)
    await tx.subOrder.update({ where: { id: sub.id }, data: { status: "paid", paidAt, commissionTotal, shipBy } })
    await tx.subOrderEvent.create({ data: { subOrderId: sub.id, fromStatus: sub.status, toStatus: "paid", actorKind: "system", note: "Payment received" } })
    await tx.ledgerEntry.createMany({
      data: saleEntries({ itemsTotal: sub.itemsTotal, deliveryFee: sub.deliveryFee, commissionTotal }).map((e) => ({ storeId: sub.storeId, subOrderId: sub.id, kind: e.kind, amount: e.amount })),
    })
  }
}

/** Takes the stock again for an order whose reservation had lapsed. Returns false if any item is short. */
async function reReserve(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
  const items = await tx.orderItem.findMany({ where: { subOrder: { orderId } }, select: { variantId: true, productId: true, quantity: true } })
  if (items.some((i) => !i.variantId)) return false
  const ids = [...new Set(items.map((i) => i.variantId!))].sort()
  const locked = await tx.$queryRaw<{ id: string; stock: number; isActive: boolean }[]>`
    SELECT "id", "stock", "isActive" FROM "product_variants" WHERE "id" = ANY(${ids}::text[]) ORDER BY "id" FOR UPDATE`
  const byId = new Map(locked.map((v) => [v.id, v]))
  const needed = new Map<string, number>()
  for (const i of items) needed.set(i.variantId!, (needed.get(i.variantId!) ?? 0) + i.quantity)
  for (const [id, qty] of needed) {
    const v = byId.get(id)
    if (!v || !v.isActive || v.stock < qty) return false
  }
  for (const [id, qty] of needed) await tx.productVariant.update({ where: { id }, data: { stock: { decrement: qty } } })
  for (const productId of new Set(items.flatMap((i) => (i.productId ? [i.productId] : [])))) await syncProductAggregates(tx, productId)
  return true
}

export async function confirmPayment(reference: string): Promise<ConfirmOutcome> {
  const payment = await prisma.payment.findUnique({ where: { reference }, include: { order: true } })
  if (!payment) return "unknown"
  if (payment.status === "succeeded") return payment.order.status === "refunded" ? "refunded" : "paid"

  const verified = await paymentProvider().verify(reference)
  if (verified.status === "pending") return "pending"
  if (verified.status !== "success") {
    await prisma.payment.updateMany({ where: { id: payment.id, status: "initialized" }, data: { status: verified.status === "abandoned" ? "abandoned" : "failed", failureReason: verified.gatewayResponse } })
    return "failed"
  }
  if (verified.amount !== payment.amount || verified.currency !== payment.currency) {
    // Never fulfil on a mismatch; flag it for a human.
    logger.error("payment amount mismatch", { reference, expected: payment.amount, got: verified.amount, currency: verified.currency })
    await prisma.payment.updateMany({ where: { id: payment.id, status: "initialized" }, data: { status: "failed", failureReason: `Amount mismatch: expected ${payment.amount}, got ${verified.amount} ${verified.currency}` } })
    return "failed"
  }

  const paidAt = verified.paidAt ?? new Date()
  type Result = { kind: "paid" } | { kind: "late_unavailable" } | { kind: "duplicate" } | { kind: "already" }
  let result: Result
  try {
    result = await prisma.$transaction(async (tx): Promise<Result> => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: "succeeded" } },
        data: { status: "succeeded", paidAt, providerTransactionId: verified.providerTransactionId, channel: verified.channel, providerFee: verified.fee, failureReason: null },
      })
      if (claimed.count !== 1) return { kind: "already" }

      const onTime = await tx.order.updateMany({ where: { id: payment.orderId, status: "awaiting_payment" }, data: { status: "paid", paidAt } })
      if (onTime.count === 1) {
        await markSubOrdersPaid(tx, payment.orderId, paidAt)
        return { kind: "paid" }
      }
      // Paid after the order expired or was cancelled: its stock was released.
      const late = await tx.order.updateMany({ where: { id: payment.orderId, status: { in: ["expired", "cancelled"] } }, data: { status: "paid", paidAt, cancelledAt: null } })
      if (late.count !== 1) return { kind: "duplicate" } // already paid by another attempt (or refunded)
      await tx.subOrder.updateMany({ where: { orderId: payment.orderId }, data: { status: "awaiting_payment" } })
      const reserved = await reReserve(tx, payment.orderId)
      await markSubOrdersPaid(tx, payment.orderId, paidAt)
      return reserved ? { kind: "paid" } : { kind: "late_unavailable" }
    })
  } catch (error) {
    // The partial unique index refused a second successful payment for this order.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") result = { kind: "duplicate" }
    else throw error
  }

  if (result.kind === "already") return (await prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } })).status === "refunded" ? "refunded" : "paid"

  if (result.kind === "duplicate") {
    // The order was already paid by another attempt: give this money straight back.
    logger.warn("duplicate payment refunded", { reference, orderId: payment.orderId })
    try {
      await paymentProvider().refund({ reference, amount: verified.amount, note: "Duplicate payment for an order that was already paid" })
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed", providerTransactionId: verified.providerTransactionId, failureReason: "Duplicate payment for an already-paid order; refunded in full." } })
    } catch (error) {
      logger.error("duplicate payment refund failed: needs manual refund", { reference, error: error instanceof Error ? error.message : String(error) })
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed", failureReason: "Duplicate payment; automatic refund FAILED, refund manually." } })
    }
    return "refunded"
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: payment.orderId },
    include: { user: { select: { name: true, email: true } }, subOrders: { include: { store: { include: { user: { select: { name: true, email: true } } } }, items: { select: { quantity: true } } } } },
  })

  if (result.kind === "late_unavailable") {
    for (const sub of order.subOrders) {
      await issueRefund({ subOrderId: sub.id, amount: sub.itemsTotal + sub.deliveryFee, reason: "Your payment arrived after the reservation ended and the items had sold out.", createdById: null, automatic: true })
    }
    return "refunded"
  }

  await notify({ to: order.user.email, ...paymentReceivedMessage(order.user.name, order.number, order.grandTotal) })
  for (const sub of order.subOrders) {
    await notify({ to: sub.store.user.email, ...newOrderMessage(sub.store.user.name, sub.store.name, order.number, sub.itemsTotal, sub.items.reduce((s, i) => s + i.quantity, 0)) })
  }
  return "paid"
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/** Writes the ledger entries and statuses for a refund the provider has completed. */
async function finalizeRefund(refundId: string) {
  const refund = await prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { subOrder: true } })
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.refund.updateMany({ where: { id: refundId, status: "pending" }, data: { status: "processed", processedAt: new Date() } })
    if (claimed.count !== 1) return
    // Same bucket as the sale: pending until released; once available, a refund may push the balance negative (recovered from later sales).
    const stillPending = await tx.ledgerEntry.count({ where: { subOrderId: refund.subOrderId, kind: "sale", bucket: "pending" } })
    await tx.ledgerEntry.createMany({
      data: refundEntries(refund).map((e) => ({ storeId: refund.subOrder.storeId, subOrderId: refund.subOrderId, refundId: refund.id, kind: e.kind, amount: e.amount, bucket: stillPending > 0 ? "pending" : "available" })),
    })
    const sub = await tx.subOrder.findUniqueOrThrow({ where: { id: refund.subOrderId } })
    if (sub.refundedTotal >= sub.itemsTotal + sub.deliveryFee && sub.status !== "refunded") {
      await tx.subOrder.update({ where: { id: sub.id }, data: { status: "refunded" } })
      await tx.subOrderEvent.create({ data: { subOrderId: sub.id, fromStatus: sub.status, toStatus: "refunded", actorKind: "system", note: "Refunded in full" } })
    }
    const open = await tx.subOrder.count({ where: { orderId: refund.orderId, status: { not: "refunded" } } })
    if (open === 0) await tx.order.update({ where: { id: refund.orderId }, data: { status: "refunded" } })
  })
}

/** Releases the amount a failed refund had reserved. */
async function failRefund(refundId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId } })
    const claimed = await tx.refund.updateMany({ where: { id: refundId, status: "pending" }, data: { status: "failed" } })
    if (claimed.count !== 1) return
    await tx.subOrder.update({ where: { id: refund.subOrderId }, data: { refundedTotal: { decrement: refund.amount } } })
    await tx.order.update({ where: { id: refund.orderId }, data: { refundedTotal: { decrement: refund.amount } } })
  })
  logger.error("refund failed", { refundId, reason })
}

export async function issueRefund({
  subOrderId,
  amount,
  reason,
  createdById,
  automatic = false,
}: {
  subOrderId: string
  amount: number
  reason: string
  createdById: string | null
  automatic?: boolean
}): Promise<{ ok: true; status: "pending" | "processed" } | { ok: false; error: string }> {
  // Reserve the amount under a row lock, so two admins can't over-refund together.
  const reserved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "sub_orders" WHERE "id" = ${subOrderId} FOR UPDATE`
    const sub = await tx.subOrder.findUnique({ where: { id: subOrderId }, include: { refunds: { where: { status: { not: "failed" } } }, order: true } })
    if (!sub) return { error: "That part of the order no longer exists." } as const
    if (!["paid", "refunded"].includes(sub.order.status)) return { error: "Only paid orders can be refunded." } as const
    const payment = await tx.payment.findFirst({ where: { orderId: sub.orderId, status: "succeeded" } })
    if (!payment) return { error: "No successful payment was found for this order." } as const
    const split = splitRefund(
      {
        itemsTotal: sub.itemsTotal,
        deliveryFee: sub.deliveryFee,
        commissionTotal: sub.commissionTotal,
        itemsRefunded: sub.refunds.reduce((s, r) => s + r.itemsAmount, 0),
        deliveryRefunded: sub.refunds.reduce((s, r) => s + r.deliveryAmount, 0),
        commissionReversed: sub.refunds.reduce((s, r) => s + r.commissionAmount, 0),
      },
      amount,
    )
    if ("error" in split) return split
    const refund = await tx.refund.create({
      data: { orderId: sub.orderId, subOrderId, paymentId: payment.id, amount, ...split, reason, automatic, createdById },
    })
    await tx.subOrder.update({ where: { id: subOrderId }, data: { refundedTotal: { increment: amount } } })
    await tx.order.update({ where: { id: sub.orderId }, data: { refundedTotal: { increment: amount } } })
    return { refund, reference: payment.reference }
  })
  if ("error" in reserved) return { ok: false, error: reserved.error! }

  try {
    const result = await paymentProvider().refund({ reference: reserved.reference, amount, note: reason })
    await prisma.refund.update({ where: { id: reserved.refund.id }, data: { providerRefundId: result.providerRefundId } })
    if (result.status === "failed") {
      await failRefund(reserved.refund.id, "provider rejected the refund")
      return { ok: false, error: "The payment service rejected the refund." }
    }
    if (result.status === "processed") await finalizeRefund(reserved.refund.id)
  } catch (error) {
    await failRefund(reserved.refund.id, error instanceof Error ? error.message : String(error))
    return { ok: false, error: "We couldn't reach the payment service; nothing was refunded. Please try again." }
  }

  const order = await prisma.order.findUniqueOrThrow({ where: { id: reserved.refund.orderId }, include: { user: { select: { name: true, email: true } } } })
  await notify({ to: order.user.email, ...refundIssuedMessage(order.user.name, order.number, amount, reason) })
  const status = (await prisma.refund.findUniqueOrThrow({ where: { id: reserved.refund.id } })).status
  return { ok: true, status: status === "processed" ? "processed" : "pending" }
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/** Handles a verified provider event. Throws to make the provider retry. */
export async function handlePaymentEvent(event: string, data: Record<string, unknown>) {
  if (event === "charge.success" && typeof data.reference === "string") {
    await confirmPayment(data.reference)
    return
  }
  if (event.startsWith("transfer.")) {
    const { handleTransferEvent } = await import("@/lib/payouts/service")
    await handleTransferEvent(event, data)
    return
  }
  if ((event === "refund.processed" || event === "refund.failed") && (typeof data.id === "number" || typeof data.id === "string")) {
    const refund = await prisma.refund.findFirst({ where: { providerRefundId: String(data.id) } })
    if (!refund) return
    if (event === "refund.processed") await finalizeRefund(refund.id)
    else await failRefund(refund.id, "provider reported the refund failed")
  }
}
