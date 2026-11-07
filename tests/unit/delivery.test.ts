import { describe, expect, it } from "vitest"

import { lineProblem, mergeQuantities, orderNumber } from "@/lib/cart/rules"
import { bandsSchema, DEFAULT_BANDS, describeQuote, feeForKm, findPlace, haversineKm, quoteDelivery, readBands, resolvePoint } from "@/lib/delivery/fee"
import { PLACES, REGION_CAPITAL } from "@/lib/delivery/places"
import { parsePin } from "@/lib/validation/common"

describe("distance", () => {
  it("measures great-circle distance", () => {
    expect(haversineKm({ lat: 5.6, lng: -0.19 }, { lat: 5.6, lng: -0.19 })).toBe(0)
    // Accra to Kumasi is about 200 km in a straight line.
    const accraKumasi = haversineKm({ lat: 5.556, lng: -0.197 }, { lat: 6.689, lng: -1.624 })
    expect(accraKumasi).toBeGreaterThan(190)
    expect(accraKumasi).toBeLessThan(210)
  })
})

describe("delivery bands", () => {
  it("picks the first band that covers the distance, with an open-ended last band", () => {
    expect(feeForKm(DEFAULT_BANDS, 0)).toBe(1500)
    expect(feeForKm(DEFAULT_BANDS, 5)).toBe(1500)
    expect(feeForKm(DEFAULT_BANDS, 5.1)).toBe(2000)
    expect(feeForKm(DEFAULT_BANDS, 299.9)).toBe(10000)
    expect(feeForKm(DEFAULT_BANDS, 1200)).toBe(14000)
  })

  it("validates band tables and falls back to the defaults when stored data is bad", () => {
    expect(bandsSchema.safeParse(DEFAULT_BANDS).success).toBe(true)
    expect(bandsSchema.safeParse([{ upToKm: 10, feePesewas: 100 }]).success).toBe(false) // last band must be open
    expect(bandsSchema.safeParse([{ upToKm: 10, feePesewas: 1 }, { upToKm: 5, feePesewas: 2 }, { upToKm: null, feePesewas: 3 }]).success).toBe(false) // not ascending
    expect(bandsSchema.safeParse([{ upToKm: null, feePesewas: 1 }, { upToKm: null, feePesewas: 2 }]).success).toBe(false)
    expect(readBands("garbage")).toEqual(DEFAULT_BANDS)
    expect(readBands([{ upToKm: null, feePesewas: 999 }])).toEqual([{ upToKm: null, feePesewas: 999 }])
  })
})

describe("place matching", () => {
  it("prefers the longest, most specific name", () => {
    expect(findPlace("East Legon")?.name).toBe("East Legon")
    expect(findPlace("Legon campus")?.name).toBe("Legon")
    expect(findPlace("Tema Community 25")?.name).toBe("Tema Community 25")
    expect(findPlace("tema")?.name).toBe("Tema")
    expect(findPlace("Abeka La Paz")?.name).toBe("Lapaz")
    expect(findPlace("near KNUST main gate")?.name).toBe("KNUST")
  })

  it("matches whole words only", () => {
    expect(findPlace("Wassa")).toBeNull() // must not match "Wa"
    expect(findPlace("Community 10")).toBeNull() // must not match "Community 1"
    expect(findPlace("")).toBeNull()
  })

  it("has a known capital for every region and sensible coordinates for every place", () => {
    for (const name of Object.values(REGION_CAPITAL)) expect(PLACES.some((p) => p.name === name)).toBe(true)
    for (const p of PLACES) {
      expect(p.lat).toBeGreaterThan(4.5)
      expect(p.lat).toBeLessThan(11.3)
      expect(p.lng).toBeGreaterThan(-3.4)
      expect(p.lng).toBeLessThan(1.3)
    }
  })

  it("resolves pin > area > town > regional capital", () => {
    expect(resolvePoint({ latitude: 5.6, longitude: -0.2, area: "East Legon", city: "Accra", region: "greater_accra" }).source).toBe("pins")
    expect(resolvePoint({ area: "East Legon", city: "Accra", region: "greater_accra" })).toMatchObject({ source: "area", label: "East Legon" })
    expect(resolvePoint({ area: "Somewhere new", city: "Tamale", region: "northern" })).toMatchObject({ source: "town", label: "Tamale" })
    expect(resolvePoint({ area: "Unknown", city: "Unknown", region: "volta" })).toMatchObject({ source: "region", label: "Ho" })
  })
})

describe("quotes", () => {
  const bands = DEFAULT_BANDS
  it("prices same-area delivery in the first band", () => {
    const q = quoteDelivery({ area: "Madina", city: "Accra", region: "greater_accra" }, { area: "Madina", city: "Accra", region: "greater_accra" }, bands, 130)
    expect(q).toEqual({ km: 0, feePesewas: 1500, source: "area" })
  })

  it("applies the road factor and reports the weaker source", () => {
    const from = { latitude: 5.637, longitude: -0.16, region: "greater_accra" as const } // pin at East Legon
    const to = { city: "Kumasi", region: "ashanti" as const } // town only
    const q = quoteDelivery(from, to, bands, 130)
    expect(q.source).toBe("town")
    expect(q.km).toBeGreaterThan(240)
    expect(q.km).toBeLessThan(280)
    expect(q.feePesewas).toBe(10000)
    expect(quoteDelivery(from, to, bands, 100).km).toBeLessThan(q.km)
  })

  it("describes how the distance was worked out", () => {
    expect(describeQuote({ km: 0.4, source: "pins" })).toBe("under 1 km")
    expect(describeQuote({ km: 12.4, source: "area" })).toBe("about 12 km, estimated between neighbourhoods")
    expect(describeQuote({ km: 260, source: "town" })).toBe("about 260 km, estimated between towns")
  })
})

describe("cart rules", () => {
  it("flags lines that can't be bought", () => {
    expect(lineProblem({ quantity: 1, stock: 5, purchasable: true })).toBeNull()
    expect(lineProblem({ quantity: 6, stock: 5, purchasable: true })).toBe("not_enough_stock")
    expect(lineProblem({ quantity: 1, stock: 0, purchasable: true })).toBe("out_of_stock")
    expect(lineProblem({ quantity: 1, stock: 5, purchasable: false })).toBe("unavailable")
  })

  it("adds quantities when merging a guest cart, capped at 20", () => {
    const merged = mergeQuantities(new Map([["a", 2], ["b", 15]]), new Map([["b", 10], ["c", 1]]))
    expect(Object.fromEntries(merged)).toEqual({ a: 2, b: 20, c: 1 })
  })

  it("makes readable order numbers without ambiguous letters", () => {
    const n = orderNumber(new Date("2026-11-18T10:00:00Z"), (len) => new Uint8Array(len).map((_, i) => i * 7))
    expect(n).toMatch(/^BM-261118-[0-9A-HJKMNP-TV-Z]{5}$/)
  })
})

describe("map pins", () => {
  it("accepts an empty pin or a pair inside Ghana", () => {
    expect(parsePin("", "")).toEqual({ ok: true, latitude: null, longitude: null })
    expect(parsePin("5.6037123456", "-0.18700009")).toEqual({ ok: true, latitude: 5.603712, longitude: -0.187 })
    expect(parsePin("5.6", "")).toMatchObject({ ok: false })
    expect(parsePin("51.5", "-0.12")).toMatchObject({ ok: false }) // London
    expect(parsePin("abc", "1")).toMatchObject({ ok: false })
  })
})
