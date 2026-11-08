// Pure money rules for payments, commission, the seller ledger and refunds.
// No database: everything here is unit-tested.

import { applyBps } from "@/lib/money"

/** Commission on one line: half-up to the pesewa, per line. */
export function lineCommission(lineTotal: number, commissionBps: number): number {
  return applyBps(lineTotal, commissionBps)
}

export function subOrderCommission(items: { lineTotal: number; commissionBps: number }[]): number {
  return items.reduce((sum, i) => sum + lineCommission(i.lineTotal, i.commissionBps), 0)
}

export type LedgerDraft = { kind: "sale" | "commission" | "delivery" | "refund" | "commission_reversal" | "delivery_refund"; amount: number }

/** What a seller is owed for a paid sub-order: items, minus commission, plus delivery. */
export function saleEntries(sub: { itemsTotal: number; deliveryFee: number; commissionTotal: number }): LedgerDraft[] {
  const entries: LedgerDraft[] = [{ kind: "sale", amount: sub.itemsTotal }]
  if (sub.commissionTotal > 0) entries.push({ kind: "commission", amount: -sub.commissionTotal })
  if (sub.deliveryFee > 0) entries.push({ kind: "delivery", amount: sub.deliveryFee })
  return entries
}

export type RefundState = {
  itemsTotal: number
  deliveryFee: number
  commissionTotal: number
  itemsRefunded: number
  deliveryRefunded: number
  commissionReversed: number
}

export type RefundSplit = { itemsAmount: number; deliveryAmount: number; commissionAmount: number }

/**
 * Splits a refund of `amount` on one sub-order: items first, then delivery.
 * Commission comes back in proportion to the items refunded so far
 * (cumulative, so several partial refunds never drift by a pesewa).
 */
export function splitRefund(state: RefundState, amount: number): RefundSplit | { error: string } {
  if (!Number.isSafeInteger(amount) || amount <= 0) return { error: "Enter an amount greater than zero." }
  const itemsLeft = state.itemsTotal - state.itemsRefunded
  const deliveryLeft = state.deliveryFee - state.deliveryRefunded
  if (amount > itemsLeft + deliveryLeft) return { error: `At most ${itemsLeft + deliveryLeft} pesewas can still be refunded on this part of the order.` }
  const itemsAmount = Math.min(amount, itemsLeft)
  const deliveryAmount = amount - itemsAmount
  const itemsAfter = state.itemsRefunded + itemsAmount
  const commissionDue = state.itemsTotal === 0 ? 0 : Math.round((state.commissionTotal * itemsAfter) / state.itemsTotal)
  return { itemsAmount, deliveryAmount, commissionAmount: Math.max(0, commissionDue - state.commissionReversed) }
}

export function refundEntries(split: RefundSplit): LedgerDraft[] {
  const entries: LedgerDraft[] = []
  if (split.itemsAmount > 0) entries.push({ kind: "refund", amount: -split.itemsAmount })
  if (split.commissionAmount > 0) entries.push({ kind: "commission_reversal", amount: split.commissionAmount })
  if (split.deliveryAmount > 0) entries.push({ kind: "delivery_refund", amount: -split.deliveryAmount })
  return entries
}

/** Payment references: "BM-261118-7K3Q9-P2" (order number + attempt). */
export function paymentReference(orderNumber: string, attempt: number): string {
  return `${orderNumber}-P${attempt}`
}

/** One webhook delivery = one processing, keyed by event type and the provider's object id. */
export function webhookDedupeKey(event: string, data: { id?: unknown; reference?: unknown }): string | null {
  const id = typeof data.id === "number" || typeof data.id === "string" ? String(data.id) : null
  const ref = typeof data.reference === "string" ? data.reference : null
  if (!id && !ref) return null
  return `${event}:${id ?? ref}`
}
