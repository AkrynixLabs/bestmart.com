import { describe, expect, it } from "vitest"

import { hashToken } from "@/lib/auth/token-hash"
import { checkMemoryLimit } from "@/lib/rate-limit"
import { slugify } from "@/lib/slug"

describe("slugify", () => {
  it.each([
    ["Ama's Fashion & Co.", "amas-fashion-co"],
    ["  Kumasi   Electronics  ", "kumasi-electronics"],
    ["Café Ébène", "cafe-ebene"],
    ["!!!", "store"],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it("caps the length without a trailing dash", () => {
    const slug = slugify("a".repeat(59) + " b")
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug.endsWith("-")).toBe(false)
  })
})

describe("hashToken", () => {
  it("is deterministic and never returns the raw token", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"))
    expect(hashToken("abc")).not.toContain("abc")
    expect(hashToken("abc")).toHaveLength(64)
  })
})

describe("in-memory rate limit", () => {
  it("allows up to the limit within a window, then resets", () => {
    const key = `test-${Math.random()}`
    const now = 1_000_000
    for (let i = 0; i < 5; i++) expect(checkMemoryLimit("signup", key, now)).toBe(true)
    expect(checkMemoryLimit("signup", key, now)).toBe(false)
    expect(checkMemoryLimit("signup", key, now + 60 * 60 * 1000 + 1)).toBe(true)
  })
})
