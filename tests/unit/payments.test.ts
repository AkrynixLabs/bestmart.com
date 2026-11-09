import { describe, expect, it } from "vitest"

import { lineCommission, paymentReference, refundEntries, saleEntries, splitRefund, subOrderCommission, webhookDedupeKey } from "@/lib/payments/rules"
import { signBody, signatureMatches } from "@/lib/payments/signature"

describe("commission", () => {
  it("is charged per line, rounding half up to the pesewa", () => {
    expect(lineCommission(4500, 1000)).toBe(450)
    expect(lineCommission(1005, 1000)).toBe(101) // 100.5 -> 101
    expect(lineCommission(1004, 1000)).toBe(100)
    expect(subOrderCommission([{ lineTotal: 1005, commissionBps: 1000 }, { lineTotal: 9000, commissionBps: 1250 }])).toBe(101 + 1125)
  })
})

describe("seller ledger", () => {
  it("credits items and delivery and debits commission", () => {
    expect(saleEntries({ itemsTotal: 9000, deliveryFee: 3000, commissionTotal: 900 })).toEqual([
      { kind: "sale", amount: 9000 },
      { kind: "commission", amount: -900 },
      { kind: "delivery", amount: 3000 },
    ])
    expect(saleEntries({ itemsTotal: 9000, deliveryFee: 0, commissionTotal: 0 })).toEqual([{ kind: "sale", amount: 9000 }])
  })
})

describe("refunds", () => {
  const fresh = { itemsTotal: 9000, deliveryFee: 3000, commissionTotal: 900, itemsRefunded: 0, deliveryRefunded: 0, commissionReversed: 0 }

  it("refunds items first, then delivery, returning commission in proportion", () => {
    expect(splitRefund(fresh, 4500)).toEqual({ itemsAmount: 4500, deliveryAmount: 0, commissionAmount: 450 })
    expect(splitRefund(fresh, 10000)).toEqual({ itemsAmount: 9000, deliveryAmount: 1000, commissionAmount: 900 })
    expect(splitRefund(fresh, 12000)).toEqual({ itemsAmount: 9000, deliveryAmount: 3000, commissionAmount: 900 })
  })

  it("never drifts over several partial refunds", () => {
    // Three refunds of a third each must give back exactly the whole commission.
    const state = { itemsTotal: 1000, deliveryFee: 0, commissionTotal: 101, itemsRefunded: 0, deliveryRefunded: 0, commissionReversed: 0 }
    let total = 0
    for (const amount of [333, 333, 334]) {
      const split = splitRefund(state, amount)
      if ("error" in split) throw new Error(split.error)
      state.itemsRefunded += split.itemsAmount
      state.commissionReversed += split.commissionAmount
      total += split.commissionAmount
    }
    expect(total).toBe(101)
  })

  it("rejects zero, negative and over-refunds", () => {
    expect(splitRefund(fresh, 0)).toHaveProperty("error")
    expect(splitRefund(fresh, -5)).toHaveProperty("error")
    expect(splitRefund(fresh, 12001)).toHaveProperty("error")
    expect(splitRefund({ ...fresh, itemsRefunded: 9000, deliveryRefunded: 3000, commissionReversed: 900 }, 1)).toHaveProperty("error")
  })

  it("turns a refund into signed ledger entries", () => {
    expect(refundEntries({ itemsAmount: 4500, deliveryAmount: 1000, commissionAmount: 450 })).toEqual([
      { kind: "refund", amount: -4500 },
      { kind: "commission_reversal", amount: 450 },
      { kind: "delivery_refund", amount: -1000 },
    ])
  })
})

describe("webhooks and references", () => {
  it("verifies HMAC-SHA512 signatures in constant time", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "BM-1" } })
    const sig = signBody(body, "secret")
    expect(sig).toMatch(/^[0-9a-f]{128}$/)
    expect(signatureMatches(body, sig, "secret")).toBe(true)
    expect(signatureMatches(body, sig, "other-secret")).toBe(false)
    expect(signatureMatches(`${body} `, sig, "secret")).toBe(false)
    expect(signatureMatches(body, null, "secret")).toBe(false)
    expect(signatureMatches(body, "not-hex", "secret")).toBe(false)
  })

  it("keys webhook deliveries by event and object id", () => {
    expect(webhookDedupeKey("charge.success", { id: 42, reference: "BM-1" })).toBe("charge.success:42")
    expect(webhookDedupeKey("charge.success", { reference: "BM-1" })).toBe("charge.success:BM-1")
    expect(webhookDedupeKey("charge.success", {})).toBeNull()
  })

  it("numbers payment attempts per order", () => {
    expect(paymentReference("BM-261118-7K3Q9", 2)).toBe("BM-261118-7K3Q9-P2")
  })
})
