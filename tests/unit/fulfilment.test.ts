import { describe, expect, it } from "vitest"

import { retryDelayMinutes } from "@/lib/email/retry"
import { addDays, allowed, autoConfirmAt, buyerCanCancel, isShipOverdue, releaseAt, reportableReasons } from "@/lib/fulfilment/rules"

const now = new Date("2026-11-18T12:00:00Z")

describe("state machine", () => {
  it("lets each party do only their own step", () => {
    expect(allowed("paid", "accept", "seller")).toBe(true)
    expect(allowed("paid", "accept", "buyer")).toBe(false)
    expect(allowed("paid", "ship", "seller")).toBe(true)
    expect(allowed("processing", "ship", "seller")).toBe(true)
    expect(allowed("shipped", "ship", "seller")).toBe(false)
    expect(allowed("shipped", "confirm", "buyer")).toBe(true)
    expect(allowed("shipped", "confirm", "system")).toBe(true)
    expect(allowed("shipped", "confirm", "seller")).toBe(false) // sellers can't confirm their own delivery
    expect(allowed("delivered", "release", "system")).toBe(true)
    expect(allowed("delivered", "release", "admin")).toBe(false)
    expect(allowed("paid", "cancel", "seller")).toBe(true)
    expect(allowed("shipped", "cancel", "seller")).toBe(false) // once shipped, it's a dispute, not a cancellation
    expect(allowed("awaiting_payment", "ship", "seller")).toBe(false)
  })

  it("lets the buyer cancel only after the shipping deadline", () => {
    expect(buyerCanCancel({ status: "paid", shipBy: addDays(now, 1) }, now)).toBe(false)
    expect(buyerCanCancel({ status: "paid", shipBy: addDays(now, -1) }, now)).toBe(true)
    expect(buyerCanCancel({ status: "processing", shipBy: addDays(now, -1) }, now)).toBe(true)
    expect(buyerCanCancel({ status: "shipped", shipBy: addDays(now, -1) }, now)).toBe(false)
    expect(isShipOverdue({ status: "paid", shipBy: addDays(now, -0.01) }, now)).toBe(true)
    expect(isShipOverdue({ status: "paid", shipBy: null }, now)).toBe(false)
  })

  it("dates auto-confirmation and release", () => {
    expect(autoConfirmAt(now, 7).toISOString()).toBe("2026-11-25T12:00:00.000Z")
    expect(releaseAt(now, 3).toISOString()).toBe("2026-11-21T12:00:00.000Z")
  })
})

describe("reporting problems", () => {
  it("allows 'not received' once shipped, everything within the return window after delivery", () => {
    expect(reportableReasons({ status: "paid", deliveredAt: null }, 7, now)).toEqual([])
    expect(reportableReasons({ status: "shipped", deliveredAt: null }, 7, now)).toEqual(["not_received"])
    expect(reportableReasons({ status: "delivered", deliveredAt: addDays(now, -2) }, 7, now)).toEqual(["not_received", "faulty", "not_as_described", "other"])
    // Still possible after the funds were released (completed), within the window: recovered from the seller.
    expect(reportableReasons({ status: "completed", deliveredAt: addDays(now, -5) }, 7, now)).toHaveLength(4)
    expect(reportableReasons({ status: "completed", deliveredAt: addDays(now, -8) }, 7, now)).toEqual([])
    expect(reportableReasons({ status: "refunded", deliveredAt: addDays(now, -1) }, 7, now)).toEqual([])
  })
})

describe("email outbox", () => {
  it("backs off between retries", () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMinutes)).toEqual([1, 5, 25, 125, 625])
  })
})
