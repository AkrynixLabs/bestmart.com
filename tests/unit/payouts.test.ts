import { describe, expect, it } from "vitest"

import { isPayoutDay, maskAccount, matchBank, MOMO_CODES, payoutReference, recipientKey } from "@/lib/payouts/rules"

const banks = [
  { name: "GCB Bank Limited", code: "GCB" },
  { name: "Ecobank Ghana Limited", code: "ECO" },
  { name: "Stanbic Bank Ghana Limited", code: "STB" },
  { name: "Consolidated Bank Ghana", code: "CBG" },
  { name: "Access Bank (Ghana) Plc", code: "ACC" },
]

describe("bank matching", () => {
  it("matches the way people write bank names", () => {
    expect(matchBank("GCB", banks)?.code).toBe("GCB")
    expect(matchBank("GCB Bank", banks)?.code).toBe("GCB")
    expect(matchBank("ecobank", banks)?.code).toBe("ECO")
    expect(matchBank("Stanbic Bank Ghana Ltd", banks)?.code).toBe("STB")
    expect(matchBank("Access Bank", banks)?.code).toBe("ACC")
  })

  it("refuses to guess when unclear or unknown", () => {
    expect(matchBank("Bank", banks)).toBeNull() // matches several
    expect(matchBank("Sunshine Bank", banks)).toBeNull()
    expect(matchBank("", banks)).toBeNull()
  })
})

describe("payout helpers", () => {
  it("maps MoMo networks to Paystack codes", () => {
    expect(MOMO_CODES).toEqual({ MTN: "MTN", Telecel: "VOD", AirtelTigo: "ATL" })
  })

  it("changes the recipient key when payout details change", () => {
    const a = recipientKey({ payoutMethod: "mobile_money", bankCode: "MTN", payoutAccountNumber: "0241234567", payoutAccountName: "Ama Mensah" })
    expect(recipientKey({ payoutMethod: "mobile_money", bankCode: "MTN", payoutAccountNumber: "0241234567", payoutAccountName: " ama mensah " })).toBe(a)
    expect(recipientKey({ payoutMethod: "mobile_money", bankCode: "MTN", payoutAccountNumber: "0241234568", payoutAccountName: "Ama Mensah" })).not.toBe(a)
  })

  it("runs on the payout weekday in Ghana time (GMT)", () => {
    expect(isPayoutDay(new Date("2026-11-23T00:30:00Z"), 1)).toBe(true) // a Monday
    expect(isPayoutDay(new Date("2026-11-22T23:30:00Z"), 1)).toBe(false) // Sunday night
  })

  it("formats references and masks accounts", () => {
    expect(payoutReference(new Date("2026-11-23T03:00:00Z"), "ab12cd34ef")).toBe("PO-261123-ab12cd34ef")
    expect(maskAccount("0241234567")).toBe("•••••• 4567")
    expect(maskAccount("1234")).toBe("1234")
  })
})
