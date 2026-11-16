import { describe, expect, it } from "vitest"

import { parseFilters } from "@/lib/catalog/filters"
import { averageRating, distribution, reviewerName, validRating } from "@/lib/reviews/rules"
import { decodeCursor, encodeCursor } from "@/lib/search/cursor"

describe("review rules", () => {
  it("accepts only whole stars from 1 to 5", () => {
    expect([1, 5, "3"].map(validRating)).toEqual([1, 5, 3])
    expect([0, 6, 2.5, "x", null].map(validRating)).toEqual([null, null, null, null, null])
  })

  it("averages to one decimal", () => {
    expect(averageRating([])).toBeNull()
    expect(averageRating([5, 4, 4])).toBe(4.3)
    expect(averageRating([1, 2])).toBe(1.5)
  })

  it("builds the star distribution, 5 down to 1", () => {
    expect(distribution({ 5: 3, 4: 1 })).toEqual([
      { stars: 5, count: 3, percent: 75 },
      { stars: 4, count: 1, percent: 25 },
      { stars: 3, count: 0, percent: 0 },
      { stars: 2, count: 0, percent: 0 },
      { stars: 1, count: 0, percent: 0 },
    ])
    expect(distribution({}).every((d) => d.percent === 0)).toBe(true)
  })

  it("shows first name and initial only", () => {
    expect(reviewerName("Ama Serwaa Mensah")).toBe("Ama M.")
    expect(reviewerName("Kofi")).toBe("Kofi")
    expect(reviewerName("  ")).toBe("A buyer")
  })
})

describe("rating filter and sort", () => {
  it("parses the minimum rating and the top-rated sort", () => {
    expect(parseFilters({ rating: "4", sort: "rating" }, [])).toMatchObject({ minRating: 4, sort: "rating", isFiltered: true })
    expect(parseFilters({ rating: "7" }, []).minRating).toBeUndefined()
  })

  it("round-trips rating cursors (decimals allowed, range-checked)", () => {
    expect(decodeCursor(encodeCursor("rating", 4.3, "p1"), "rating")).toEqual({ value: 4.3, id: "p1" })
    expect(decodeCursor(encodeCursor("rating", 9, "p1"), "rating")).toBeNull()
    expect(decodeCursor(encodeCursor("price_asc", 4.3, "p1"), "price_asc")).toBeNull()
  })
})
