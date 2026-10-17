import { describe, expect, it } from "vitest"

import { applyBps, formatGhs, parseGhs } from "@/lib/money"

describe("formatGhs", () => {
  it("formats pesewas as cedis with two decimals", () => {
    expect(formatGhs(1250)).toMatch(/12\.50$/)
    expect(formatGhs(0)).toMatch(/0\.00$/)
    expect(formatGhs(123456789)).toMatch(/1,234,567\.89$/)
  })

  it("rejects non-integer amounts so float bugs can't reach the UI silently", () => {
    expect(() => formatGhs(12.5)).toThrow(RangeError)
  })
})

describe("parseGhs", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    ["1,200.00", 120000],
    ["GH₵ 9.99", 999],
    ["GHS 0.01", 1],
  ])("parses %s as %i pesewas", (input, expected) => {
    expect(parseGhs(input)).toBe(expected)
  })

  it.each(["", "abc", "-5", "1.234", "1.2.3", "12.", ".5"])("rejects %j", (input) => {
    expect(parseGhs(input)).toBeNull()
  })
})

describe("applyBps", () => {
  it("computes 10% commission exactly", () => {
    expect(applyBps(20000, 1000)).toBe(2000)
  })

  it("rounds half up to the nearest pesewa", () => {
    expect(applyBps(5, 1000)).toBe(1) // 0.5 -> 1
    expect(applyBps(4, 1000)).toBe(0) // 0.4 -> 0
    expect(applyBps(1999, 1250)).toBe(250) // 249.875 -> 250
  })

  it("rejects invalid inputs", () => {
    expect(() => applyBps(10.5, 1000)).toThrow(RangeError)
    expect(() => applyBps(100, -1)).toThrow(RangeError)
    expect(() => applyBps(100, 2.5)).toThrow(RangeError)
  })
})
