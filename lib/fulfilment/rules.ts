// Pure fulfilment rules: the sub-order state machine, deadlines and what
// each party may do. No database; unit-tested.
//
//   paid ──accept──▶ processing ──ship──▶ shipped ──confirm──▶ delivered ──release──▶ completed
//    │                  │                    (buyer / auto after N days / admin)   (after the hold)
//    └──── cancel (seller any time; buyer after the shipping deadline) ──▶ refunded
//
// An open dispute freezes auto-confirmation and release.

export type SubStatus = "awaiting_payment" | "paid" | "processing" | "shipped" | "delivered" | "completed" | "cancelled" | "expired" | "refunded"
export type Actor = "buyer" | "seller" | "admin" | "system"
export type Action = "accept" | "ship" | "confirm" | "release" | "cancel"

const DAY = 24 * 60 * 60 * 1000

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY)
}

/** Whether `actor` may perform `action` on a sub-order in `status` (deadlines checked separately). */
export function allowed(status: SubStatus, action: Action, actor: Actor): boolean {
  switch (action) {
    case "accept":
      return status === "paid" && actor === "seller"
    case "ship":
      return (status === "paid" || status === "processing") && actor === "seller"
    case "confirm":
      return status === "shipped" && (actor === "buyer" || actor === "system" || actor === "admin")
    case "release":
      return status === "delivered" && actor === "system"
    case "cancel":
      return (status === "paid" || status === "processing") && (actor === "seller" || actor === "buyer" || actor === "admin")
  }
}

export const nextStatus: Record<Exclude<Action, "cancel">, SubStatus> = {
  accept: "processing",
  ship: "shipped",
  confirm: "delivered",
  release: "completed",
}

/** The buyer may cancel an unshipped part only after the seller's shipping deadline. */
export function buyerCanCancel(sub: { status: SubStatus; shipBy: Date | null }, now: Date): boolean {
  return allowed(sub.status, "cancel", "buyer") && sub.shipBy !== null && now > sub.shipBy
}

export function isShipOverdue(sub: { status: SubStatus; shipBy: Date | null }, now: Date): boolean {
  return (sub.status === "paid" || sub.status === "processing") && sub.shipBy !== null && now > sub.shipBy
}

/** Auto-confirmation date for a shipped part. */
export function autoConfirmAt(shippedAt: Date, days: number): Date {
  return addDays(shippedAt, days)
}

/** When a delivered part's money becomes available. */
export function releaseAt(deliveredAt: Date, holdDays: number): Date {
  return addDays(deliveredAt, holdDays)
}

export type DisputeReason = "not_received" | "faulty" | "not_as_described" | "other"

/**
 * Which problems a buyer can report now (empty = none):
 *  - "not received": once shipped, or after delivery while still in the return window;
 *  - faulty / not as described / other: after delivery, within the return window.
 */
export function reportableReasons(sub: { status: SubStatus; deliveredAt: Date | null }, returnWindowDays: number, now: Date): DisputeReason[] {
  if (sub.status === "shipped") return ["not_received"]
  if ((sub.status === "delivered" || sub.status === "completed") && sub.deliveredAt && now <= addDays(sub.deliveredAt, returnWindowDays)) {
    return ["not_received", "faulty", "not_as_described", "other"]
  }
  return []
}

export const reasonLabel: Record<DisputeReason, string> = {
  not_received: "I haven't received it",
  faulty: "It's faulty or damaged",
  not_as_described: "It's not as described",
  other: "Something else",
}

export const statusLabel: Record<SubStatus, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid, waiting for the seller",
  processing: "Being prepared",
  shipped: "On its way",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  refunded: "Refunded",
}
