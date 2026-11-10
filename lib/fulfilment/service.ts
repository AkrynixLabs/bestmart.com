import "server-only"
import { randomUUID } from "node:crypto"

import { syncProductAggregates } from "@/lib/catalog/products"
import { enqueueEmail, flushOutbox, flushOutboxSoon } from "@/lib/email/outbox"
import {
  deliveredMessage,
  disputeOpenedMessage,
  disputeResolvedMessage,
  overdueShipmentMessage,
  sellerCancelledMessage,
  shippedMessage,
} from "@/lib/email/templates"
import type { ActorKind, DeliveryMethod, DisputeOutcome, Prisma, SubOrderStatus } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import { formatGhs } from "@/lib/money"
import { issueRefund } from "@/lib/payments/service"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import { appUrl } from "@/lib/site"
import { putPrivate } from "@/lib/storage"
import { EXTENSION, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/validation/files"

import { addDays, allowed, buyerCanCancel, reasonLabel, releaseAt, reportableReasons, type DisputeReason } from "./rules"

// Fulfilment actions. Every status change goes through transition(): a
// conditional update (so two clicks or a click racing the daily job can't
// both win) plus a history event, in one transaction. Emails go through the
// outbox in the same transaction.

export class FulfilmentError extends Error {}

const dateText = (d: Date) => d.toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short" })

async function transition(
  tx: Prisma.TransactionClient,
  subOrderId: string,
  from: SubOrderStatus[],
  to: SubOrderStatus,
  actor: { kind: ActorKind; id: string | null },
  data: Prisma.SubOrderUpdateManyMutationInput = {},
  note?: string,
): Promise<boolean> {
  const current = await tx.subOrder.findUnique({ where: { id: subOrderId }, select: { status: true } })
  if (!current || !from.includes(current.status)) return false
  const claimed = await tx.subOrder.updateMany({ where: { id: subOrderId, status: current.status }, data: { ...data, status: to } })
  if (claimed.count !== 1) return false
  await tx.subOrderEvent.create({ data: { subOrderId, fromStatus: current.status, toStatus: to, actorKind: actor.kind, actorId: actor.id, note } })
  return true
}

const subInclude = {
  order: { include: { user: { select: { id: true, name: true, email: true } } } },
  store: { include: { user: { select: { id: true, name: true, email: true } } } },
} satisfies Prisma.SubOrderInclude

async function loadSub(subOrderId: string) {
  return prisma.subOrder.findUnique({ where: { id: subOrderId }, include: subInclude })
}

async function hasOpenDispute(tx: Prisma.TransactionClient, subOrderId: string) {
  return (await tx.dispute.count({ where: { subOrderId, status: "open" } })) > 0
}

/** Puts a cancelled part's items back on sale. */
async function restock(tx: Prisma.TransactionClient, subOrderId: string) {
  const items = await tx.orderItem.findMany({ where: { subOrderId, variantId: { not: null } }, select: { variantId: true, productId: true, quantity: true } })
  for (const i of items) await tx.productVariant.updateMany({ where: { id: i.variantId! }, data: { stock: { increment: i.quantity } } })
  for (const productId of new Set(items.flatMap((i) => (i.productId ? [i.productId] : [])))) await syncProductAggregates(tx, productId)
}

// ---------------------------------------------------------------------------
// Seller actions
// ---------------------------------------------------------------------------

export async function acceptSubOrder(storeId: string, sellerUserId: string, subOrderId: string) {
  const ok = await prisma.$transaction((tx) =>
    tx.subOrder.count({ where: { id: subOrderId, storeId } }).then((owned) => (owned ? transition(tx, subOrderId, ["paid"], "processing", { kind: "seller", id: sellerUserId }, { acceptedAt: new Date() }) : false)),
  )
  if (!ok) throw new FulfilmentError("This order can't be accepted any more.")
}

export type ShipInput = { method: DeliveryMethod; carrierName: string; riderPhone: string | null; trackingNumber: string | null }

export async function markShipped(storeId: string, sellerUserId: string, subOrderId: string, input: ShipInput) {
  const sub = await loadSub(subOrderId)
  if (!sub || sub.storeId !== storeId) throw new FulfilmentError("Order not found.")
  const how =
    input.method === "own_rider"
      ? `It's coming with ${input.carrierName}, rider phone ${input.riderPhone}.`
      : `It's with ${input.carrierName}${input.trackingNumber ? `, tracking number ${input.trackingNumber}` : ""}${input.riderPhone ? `, phone ${input.riderPhone}` : ""}.`
  const ok = await prisma.$transaction(async (tx) => {
    const moved = await transition(tx, subOrderId, ["paid", "processing"], "shipped", { kind: "seller", id: sellerUserId }, {
      shippedAt: new Date(),
      deliveryMethod: input.method,
      carrierName: input.carrierName,
      riderPhone: input.riderPhone,
      trackingNumber: input.trackingNumber,
    })
    if (moved) await enqueueEmail(tx, { to: sub.order.user.email, ...shippedMessage(sub.order.user.name, sub.order.number, sub.store.name, how) })
    return moved
  })
  if (!ok) throw new FulfilmentError("This order can't be marked shipped any more.")
  await flushOutboxSoon()
}

// ---------------------------------------------------------------------------
// Cancelling an unshipped part (seller any time; buyer after the deadline; admin)
// ---------------------------------------------------------------------------

export async function cancelSubOrder({ subOrderId, actor, reason }: { subOrderId: string; actor: { kind: "buyer" | "seller" | "admin"; id: string; storeId?: string }; reason: string }) {
  const sub = await loadSub(subOrderId)
  if (!sub) throw new FulfilmentError("Order not found.")
  if (actor.kind === "seller" && sub.storeId !== actor.storeId) throw new FulfilmentError("Order not found.")
  if (actor.kind === "buyer") {
    if (sub.order.userId !== actor.id) throw new FulfilmentError("Order not found.")
    if (!buyerCanCancel(sub, new Date())) throw new FulfilmentError("You can cancel only after the seller's shipping deadline has passed.")
  }
  if (!allowed(sub.status, "cancel", actor.kind)) throw new FulfilmentError("This part of the order can't be cancelled any more (it may already be on its way).")

  const ok = await prisma.$transaction(async (tx) => {
    const moved = await transition(tx, subOrderId, ["paid", "processing"], "cancelled", { kind: actor.kind, id: actor.id }, {}, reason)
    if (!moved) return false
    await restock(tx, subOrderId)
    if (actor.kind === "seller") await enqueueEmail(tx, { to: sub.order.user.email, ...sellerCancelledMessage(sub.order.user.name, sub.order.number, sub.store.name, reason) })
    return true
  })
  if (!ok) throw new FulfilmentError("This part of the order can't be cancelled any more.")
  await flushOutboxSoon()

  const refund = await issueRefund({ subOrderId, amount: sub.itemsTotal + sub.deliveryFee - sub.refundedTotal, reason: `Order cancelled: ${reason}`, createdById: actor.kind === "admin" ? actor.id : null, automatic: actor.kind !== "admin" })
  if (!refund.ok) {
    // The part is cancelled and restocked, but the money didn't go back: needs a person.
    logger.error("refund after cancellation failed: refund manually", { subOrderId, error: refund.error })
    throw new FulfilmentError("Cancelled, but the refund didn't go through yet. Our team has been alerted and will refund you.")
  }
}

// ---------------------------------------------------------------------------
// Delivery confirmation and fund release
// ---------------------------------------------------------------------------

async function confirm(subOrderId: string, actor: { kind: ActorKind; id: string | null }) {
  const settings = await getPlatformSettings()
  const sub = await loadSub(subOrderId)
  if (!sub) return false
  const now = new Date()
  const ok = await prisma.$transaction(async (tx) => {
    if (actor.kind === "system" && (await hasOpenDispute(tx, subOrderId))) return false
    const moved = await transition(tx, subOrderId, ["shipped"], "delivered", actor, { deliveredAt: now, confirmedBy: actor.kind })
    if (moved) {
      await enqueueEmail(tx, { to: sub.store.user.email, ...deliveredMessage(sub.store.user.name, sub.store.name, sub.order.number, actor.kind === "system", dateText(releaseAt(now, settings.payoutHoldDays))) })
    }
    return moved
  })
  return ok
}

export async function confirmDelivery(buyerId: string, subOrderId: string) {
  const sub = await prisma.subOrder.findFirst({ where: { id: subOrderId, order: { userId: buyerId } }, select: { id: true } })
  if (!sub || !(await confirm(sub.id, { kind: "buyer", id: buyerId }))) throw new FulfilmentError("This can't be confirmed (it may already be confirmed).")
  await flushOutboxSoon()
}

/** Shipped parts past the auto-confirm window, with no open problem, become delivered. */
export async function runAutoConfirm(now = new Date()): Promise<number> {
  const settings = await getPlatformSettings()
  const due = await prisma.subOrder.findMany({
    where: { status: "shipped", shippedAt: { lte: addDays(now, -settings.autoConfirmDeliveryDays) }, disputes: { none: { status: "open" } } },
    select: { id: true },
    take: 200,
  })
  let count = 0
  for (const { id } of due) if (await confirm(id, { kind: "system", id: null })) count++
  return count
}

/** Delivered parts past the payout hold, with no open problem: earnings become available. */
export async function runRelease(now = new Date()): Promise<number> {
  const settings = await getPlatformSettings()
  const due = await prisma.subOrder.findMany({
    where: { status: "delivered", deliveredAt: { lte: addDays(now, -settings.payoutHoldDays) }, disputes: { none: { status: "open" } } },
    select: { id: true },
    take: 200,
  })
  let count = 0
  for (const { id } of due) {
    const ok = await prisma.$transaction(async (tx) => {
      if (await hasOpenDispute(tx, id)) return false
      const moved = await transition(tx, id, ["delivered"], "completed", { kind: "system", id: null }, { completedAt: now }, "Earnings released to the seller")
      if (moved) await tx.ledgerEntry.updateMany({ where: { subOrderId: id, bucket: "pending" }, data: { bucket: "available", releasedAt: now } })
      return moved
    })
    if (ok) count++
  }
  return count
}

/** Tells buyers once when a seller misses the shipping deadline (they may then cancel). */
export async function runOverdueNotices(now = new Date()): Promise<number> {
  const due = await prisma.subOrder.findMany({
    where: { status: { in: ["paid", "processing"] }, shipBy: { lt: now }, overdueNotifiedAt: null },
    include: subInclude,
    take: 200,
  })
  let count = 0
  for (const sub of due) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.subOrder.updateMany({ where: { id: sub.id, overdueNotifiedAt: null }, data: { overdueNotifiedAt: now } })
      if (claimed.count === 1) {
        await enqueueEmail(tx, { to: sub.order.user.email, ...overdueShipmentMessage(sub.order.user.name, sub.order.number, sub.store.name) })
        count++
      }
    })
  }
  return count
}

/** Everything time-based; run by the daily cron and opportunistically on page views. */
export async function runFulfilmentJobs(now = new Date()) {
  const [confirmed, released, overdue] = [await runAutoConfirm(now), await runRelease(now), await runOverdueNotices(now)]
  const emails = await flushOutbox()
  return { confirmed, released, overdue, emails }
}

/** Cheap enough to call when someone looks at orders or earnings; never throws. */
export async function catchUpFulfilment() {
  try {
    await runAutoConfirm()
    await runRelease()
  } catch (error) {
    logger.error("fulfilment catch-up failed", { error: error instanceof Error ? error.message : String(error) })
  }
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export const MAX_DISPUTE_PHOTOS = 3

export async function openDispute({ buyerId, subOrderId, reason, description, photos }: { buyerId: string; subOrderId: string; reason: DisputeReason; description: string; photos: File[] }) {
  const settings = await getPlatformSettings()
  const sub = await loadSub(subOrderId)
  if (!sub || sub.order.userId !== buyerId) throw new FulfilmentError("Order not found.")
  if (!reportableReasons(sub, settings.returnWindowDays, new Date()).includes(reason)) throw new FulfilmentError("That problem can't be reported for this order now.")
  if (photos.length > MAX_DISPUTE_PHOTOS) throw new FulfilmentError(`Attach at most ${MAX_DISPUTE_PHOTOS} photos.`)

  // Check and store the photos before touching the database.
  const stored: { key: string; contentType: string }[] = []
  for (const photo of photos) {
    if (photo.size > MAX_UPLOAD_BYTES) throw new FulfilmentError("Each photo must be 4 MB or smaller.")
    const bytes = new Uint8Array(await photo.arrayBuffer())
    const type = sniffImageType(bytes)
    if (!type) throw new FulfilmentError("Photos must be JPG, PNG or WebP images.")
    stored.push({ key: await putPrivate(`disputes/${subOrderId}/${randomUUID()}.${EXTENSION[type]}`, bytes, type), contentType: type })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.create({ data: { orderId: sub.orderId, subOrderId, openedById: buyerId, reason, description, attachments: { create: stored } } })
      await tx.subOrderEvent.create({ data: { subOrderId, fromStatus: sub.status, toStatus: sub.status, actorKind: "buyer", actorId: buyerId, note: `Problem reported: ${reasonLabel[reason]}` } })
      await enqueueEmail(tx, { to: sub.store.user.email, ...disputeOpenedMessage(sub.store.user.name, sub.store.name, sub.order.number, reasonLabel[reason].toLowerCase(), subOrderId) })
      return dispute
    })
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") throw new FulfilmentError("You've already reported a problem with this order; our team is on it.")
    throw error
  }
  await flushOutboxSoon()
}

export async function respondToDispute(storeId: string, disputeId: string, response: string) {
  const updated = await prisma.dispute.updateMany({ where: { id: disputeId, status: "open", subOrder: { storeId } }, data: { sellerResponse: response } })
  if (updated.count !== 1) throw new FulfilmentError("This problem is no longer open.")
}

export async function resolveDispute({ adminId, disputeId, outcome, amount, note }: { adminId: string; disputeId: string; outcome: DisputeOutcome; amount: number | null; note: string | null }) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId }, include: { subOrder: { include: subInclude } } })
  if (!dispute || dispute.status !== "open") throw new FulfilmentError("This problem is no longer open.")
  const sub = dispute.subOrder
  const left = sub.itemsTotal + sub.deliveryFee - sub.refundedTotal
  const refundAmount = outcome === "full_refund" ? left : outcome === "partial_refund" ? amount : null
  if (outcome !== "rejected" && (!refundAmount || refundAmount <= 0 || refundAmount > left)) throw new FulfilmentError(`Enter a refund between GH₵0.01 and ${formatGhs(left)}.`)

  // Claim the dispute first so two admins can't both refund it.
  const claimed = await prisma.dispute.updateMany({ where: { id: disputeId, status: "open" }, data: { status: "resolved", outcome, resolutionNote: note, resolvedById: adminId, resolvedAt: new Date() } })
  if (claimed.count !== 1) throw new FulfilmentError("Another admin has just resolved this.")

  if (refundAmount) {
    const refund = await issueRefund({ subOrderId: sub.id, amount: refundAmount, reason: note ?? `Resolution of a reported problem (${reasonLabel[dispute.reason].toLowerCase()})`, createdById: adminId })
    if (!refund.ok) {
      await prisma.dispute.update({ where: { id: disputeId }, data: { status: "open", outcome: null, resolutionNote: null, resolvedById: null, resolvedAt: null } })
      throw new FulfilmentError(refund.error)
    }
    const latest = await prisma.refund.findFirst({ where: { subOrderId: sub.id }, orderBy: { createdAt: "desc" }, select: { id: true } })
    await prisma.dispute.update({ where: { id: disputeId }, data: { refundId: latest?.id ?? null } })
  }

  const outcomeText = outcome === "rejected" ? "after reviewing it, we haven't issued a refund." : `we've refunded ${formatGhs(refundAmount!)}.`
  await prisma.$transaction(async (tx) => {
    await tx.subOrderEvent.create({ data: { subOrderId: sub.id, fromStatus: sub.status, toStatus: (await tx.subOrder.findUniqueOrThrow({ where: { id: sub.id } })).status, actorKind: "admin", actorId: adminId, note: `Problem resolved: ${outcome.replace("_", " ")}` } })
    await enqueueEmail(tx, { to: sub.order.user.email, ...disputeResolvedMessage(sub.order.user.name, sub.order.number, outcomeText, note, `${appUrl()}/orders/${sub.order.number}`) })
    await enqueueEmail(tx, { to: sub.store.user.email, ...disputeResolvedMessage(sub.store.user.name, sub.order.number, outcome === "rejected" ? "no refund was issued; your earnings are released on the normal schedule." : `the buyer was refunded ${formatGhs(refundAmount!)} from this order.`, note, `${appUrl()}/seller/orders/${sub.id}`) })
  })
  await flushOutboxSoon()
}
