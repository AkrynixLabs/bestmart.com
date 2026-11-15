import { describe, expect, it } from "vitest"

import { cedis, toCsv } from "@/lib/reports/csv"
import { daysIn, parseRange } from "@/lib/reports/range"

const now = new Date("2026-11-18T15:00:00Z")

describe("report ranges", () => {
  it("builds presets with an exclusive end", () => {
    const r = parseRange({ preset: "last_7" }, now)
    expect([r.fromInput, r.toInput, r.to.toISOString()]).toEqual(["2026-11-12", "2026-11-18", "2026-11-19T00:00:00.000Z"])
    expect(parseRange({ preset: "this_month" }, now).fromInput).toBe("2026-11-01")
    const last = parseRange({ preset: "last_month" }, now)
    expect([last.fromInput, last.toInput]).toEqual(["2026-10-01", "2026-10-31"])
  })

  it("parses custom dates, swaps reversed ones, caps at a year and defaults to 30 days", () => {
    expect(parseRange({ from: "2026-11-10", to: "2026-11-01" }, now)).toMatchObject({ fromInput: "2026-11-01", toInput: "2026-11-10" })
    expect(parseRange({ from: "2020-01-01", to: "2026-11-18" }, now).fromInput).toBe("2025-11-18")
    expect(parseRange({ from: "nonsense" }, now).label).toBe("Last 30 days")
  })

  it("lists every day in the range", () => {
    expect(daysIn(parseRange({ from: "2026-11-01", to: "2026-11-03" }, now))).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"])
  })
})

describe("csv", () => {
  it("quotes where needed and defuses formulas", () => {
    expect(toCsv([["Store", "Sales"], ['Ama "Best", Ltd', 12.5], ["=HYPERLINK(1)", "-2"], [null, 0]])).toBe(
      'Store,Sales\r\n"Ama ""Best"", Ltd",12.5\r\n\'=HYPERLINK(1),\'-2\r\n,0\r\n',
    )
    expect(cedis(123450)).toBe("1234.50")
  })
})
