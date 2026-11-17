import { describe, expect, it } from "vitest"

import { parseFilters, withParams } from "@/lib/catalog/filters"
import { aggregates, combinations, formatAttributeValue, parseAttributeValues, publishProblems, readOptions, suggestSku } from "@/lib/catalog/product-rules"
import {
  ancestry,
  attributeKeyConflict,
  buildTree,
  categoryLabel,
  effectiveAttributes,
  effectiveCommissionBps,
  isVisible,
  listableCategories,
  moveError,
  subtreeIds,
  type TreeAttribute,
  type TreeCategory,
} from "@/lib/catalog/tree"
import { toCediInput } from "@/lib/money"
import { decodeCursor, encodeCursor } from "@/lib/search/cursor"
import { productSlug } from "@/lib/slug"
import { attributeKeyFrom, attributeSchema, categorySchema, splitList, variantsPayloadSchema } from "@/lib/validation/catalog"
import { sniffImageType } from "@/lib/validation/files"

const attr = (id: string, categoryId: string, key: string, extra: Partial<TreeAttribute> = {}): TreeAttribute => ({
  id,
  categoryId,
  key,
  name: key,
  type: "select",
  unit: null,
  options: ["A", "B"],
  isRequired: false,
  isFilterable: true,
  sortOrder: 0,
  ...extra,
})

const cat = (id: string, parentId: string | null, depth: number, extra: Partial<TreeCategory> = {}): TreeCategory => ({
  id,
  parentId,
  name: id,
  slug: id,
  description: null,
  imageUrl: null,
  depth,
  sortOrder: 0,
  status: "active",
  commissionBps: null,
  seoTitle: null,
  seoDescription: null,
  attributes: [],
  ...extra,
})

// fashion > women > dresses ; fashion > men ; electronics (hidden) > phones
const tree = buildTree([
  cat("fashion", null, 0, { name: "Fashion", attributes: [attr("a1", "fashion", "material", { isRequired: true })], commissionBps: 1200 }),
  cat("women", "fashion", 1, { name: "Women", sortOrder: 1 }),
  cat("men", "fashion", 1, { name: "Men", sortOrder: 2 }),
  cat("dresses", "women", 2, { name: "Dresses", attributes: [attr("a2", "dresses", "length")] }),
  cat("electronics", null, 0, { status: "hidden" }),
  cat("phones", "electronics", 1, { attributes: [attr("a3", "phones", "storage", { type: "number", options: [], unit: "GB" })] }),
])

describe("category tree", () => {
  it("walks ancestry and subtrees", () => {
    expect(ancestry(tree, "dresses").map((c) => c.id)).toEqual(["fashion", "women", "dresses"])
    expect(subtreeIds(tree, "fashion")).toEqual(["fashion", "women", "dresses", "men"])
    expect(categoryLabel(tree, "dresses")).toBe("Fashion › Women › Dresses")
  })

  it("hides a category when any ancestor is hidden", () => {
    expect(isVisible(tree, "dresses")).toBe(true)
    expect(isVisible(tree, "phones")).toBe(false)
    expect(isVisible(tree, "missing")).toBe(false)
  })

  it("inherits attributes root first and the nearest commission", () => {
    expect(effectiveAttributes(tree, "dresses").map((a) => a.key)).toEqual(["material", "length"])
    expect(effectiveCommissionBps(tree, "dresses", 1000)).toBe(1200)
    expect(effectiveCommissionBps(tree, "phones", 1000)).toBe(1000)
  })

  it("only offers visible leaf categories to sellers", () => {
    // Sorted by full label: "Fashion › Men" before "Fashion › Women › Dresses".
    expect(listableCategories(tree).map((c) => c.id)).toEqual(["men", "dresses"])
  })

  it("rejects cycles and moves that make the tree deeper than three levels", () => {
    expect(moveError(tree, "fashion", "dresses")).toMatch(/inside its own/)
    expect(moveError(tree, "women", "men")).toMatch(/three levels/) // women has a child, men is level 1
    expect(moveError(tree, "dresses", "men")).toBeNull()
    expect(moveError(tree, "women", null)).toBeNull()
    expect(moveError(tree, "men", "men")).toMatch(/own parent/)
  })

  it("keeps attribute keys unique along a branch", () => {
    expect(attributeKeyConflict(tree, "women", "material")).toBe("Fashion") // ancestor has it
    expect(attributeKeyConflict(tree, "fashion", "length")).toBe("Dresses") // descendant has it
    expect(attributeKeyConflict(tree, "men", "length")).toBeNull() // different branch
    expect(attributeKeyConflict(tree, "fashion", "material", "a1")).toBeNull() // editing itself
  })
})

describe("product rules", () => {
  it("builds every option combination", () => {
    expect(combinations([])).toEqual([[]])
    expect(combinations([{ name: "Size", values: ["S", "M"] }, { name: "Colour", values: ["Red", "Blue"] }])).toEqual([
      ["S", "Red"],
      ["S", "Blue"],
      ["M", "Red"],
      ["M", "Blue"],
    ])
  })

  it("reads stored options defensively", () => {
    expect(readOptions([{ name: "Size", values: ["S", 3] }, "junk", null])).toEqual([{ name: "Size", values: ["S"] }])
    expect(readOptions("nope")).toEqual([])
  })

  it("aggregates price range and stock from active variants only", () => {
    expect(
      aggregates([
        { price: 5000, stock: 2, isActive: true },
        { price: 3000, stock: 0, isActive: true },
        { price: 1000, stock: 9, isActive: false },
      ]),
    ).toEqual({ minPrice: 3000, maxPrice: 5000, totalStock: 2 })
    expect(aggregates([])).toEqual({ minPrice: 0, maxPrice: 0, totalStock: 0 })
  })

  it("suggests readable SKUs", () => {
    expect(suggestSku("Kente stole (gold)", ["XL", "Royal blue"])).toBe("KENTE-STOLE-GOLD-XL-ROYAL-BLUE")
    expect(suggestSku("!!!", [])).toBe("ITEM")
  })

  it("parses attribute inputs by type and skips empty ones", () => {
    const attributes = [
      attr("t", "c", "brand", { type: "text", options: [] }),
      attr("n", "c", "storage", { type: "number", options: [] }),
      attr("s", "c", "colour", { type: "select", options: ["Red", "Blue"] }),
      attr("m", "c", "features", { type: "multiselect", options: ["5G", "NFC", "Dual SIM"] }),
      attr("b", "c", "warranty", { type: "boolean", options: [] }),
      attr("e", "c", "empty", { type: "text", options: [] }),
    ]
    const form: Record<string, string[]> = {
      "attr.brand": ["  Tecno  "],
      "attr.storage": ["1,024"],
      "attr.colour": ["Red"],
      "attr.features": ["NFC", "5G"],
      "attr.warranty": ["yes"],
      "attr.empty": ["   "],
    }
    const { values, errors } = parseAttributeValues(attributes, (name) => form[name] ?? [])
    expect(errors).toEqual({})
    expect(values).toEqual([
      { attributeId: "t", textValues: ["Tecno"], numberValue: null, booleanValue: null },
      { attributeId: "n", textValues: [], numberValue: 1024, booleanValue: null },
      { attributeId: "s", textValues: ["Red"], numberValue: null, booleanValue: null },
      { attributeId: "m", textValues: ["5G", "NFC"], numberValue: null, booleanValue: null },
      { attributeId: "b", textValues: [], numberValue: null, booleanValue: true },
    ])
  })

  it("rejects values outside an attribute's choices", () => {
    const { errors } = parseAttributeValues([attr("s", "c", "colour"), attr("n", "c", "size", { type: "number", options: [] })], (name) =>
      name === "attr.colour" ? ["Purple"] : ["abc"],
    )
    expect(Object.keys(errors).sort()).toEqual(["attr.colour", "attr.size"])
  })

  it("formats attribute values for the spec table", () => {
    expect(formatAttributeValue({ type: "number", unit: "GB" }, { textValues: [], numberValue: 128, booleanValue: null })).toBe("128 GB")
    expect(formatAttributeValue({ type: "boolean", unit: null }, { textValues: [], numberValue: null, booleanValue: false })).toBe("No")
    expect(formatAttributeValue({ type: "multiselect", unit: null }, { textValues: ["5G", "NFC"], numberValue: null, booleanValue: null })).toBe("5G, NFC")
  })

  it("lists what blocks publishing", () => {
    const ready = {
      title: "Kente stole",
      description: "Handwoven in Bonwire, 2 metres long.",
      categoryListable: true,
      imageCount: 1,
      variants: [{ price: 1000, stock: 0, isActive: true }],
      requiredAttributes: [{ id: "a1", name: "Material" }],
      filledAttributeIds: ["a1"],
    }
    expect(publishProblems(ready)).toEqual([])
    const problems = publishProblems({ ...ready, description: "short", imageCount: 0, variants: [], filledAttributeIds: [], categoryListable: false })
    expect(problems).toHaveLength(5)
    expect(problems.join(" ")).toMatch(/Material/)
  })
})

describe("catalog validation", () => {
  it("validates a category and converts commission to basis points", () => {
    const ok = categorySchema.parse({ name: " Phones ", slug: "", parentId: "", commissionPercent: "12.5", sortOrder: "3", status: "active" })
    expect(ok).toMatchObject({ name: "Phones", slug: undefined, parentId: null, commissionPercent: 1250, sortOrder: 3 })
    expect(categorySchema.parse({ name: "X", commissionPercent: "" }).commissionPercent).toBeNull()
    expect(categorySchema.safeParse({ name: "X", commissionPercent: "101" }).success).toBe(false)
    expect(categorySchema.safeParse({ name: "X", slug: "Bad Slug" }).success).toBe(false)
  })

  it("requires choices for list attributes and drops them for others", () => {
    expect(attributeSchema.safeParse({ name: "Colour", type: "select", options: "Red" }).success).toBe(false)
    expect(attributeSchema.parse({ name: "Colour", type: "select", options: "Red, Blue, red" }).options).toEqual(["Red", "Blue"])
    expect(attributeSchema.parse({ name: "Weight", type: "number", unit: "kg", options: "a, b" })).toMatchObject({ options: [], unit: "kg" })
    expect(attributeSchema.parse({ name: "Note", type: "text", unit: "kg" }).unit).toBeUndefined()
  })

  it("makes attribute keys and splits lists", () => {
    expect(attributeKeyFrom("Screen size (inches)")).toBe("screen_size_inches")
    expect(splitList("S, M,\nL, m ,")).toEqual(["S", "M", "L"])
  })

  const variant = { sku: "A-1", optionValues: ["S"], price: "10", compareAtPrice: "", stock: "3", isActive: true }
  it("accepts a consistent variants payload with prices in pesewas", () => {
    const parsed = variantsPayloadSchema.parse({ options: [{ name: "Size", values: ["S", "M"] }], variants: [variant, { ...variant, sku: "A-2", optionValues: ["M"], price: "12.50", compareAtPrice: "15" }] })
    expect(parsed.variants.map((v) => [v.price, v.compareAtPrice, v.stock])).toEqual([
      [1000, undefined, 3],
      [1250, 1500, 3],
    ])
  })

  it("rejects duplicate SKUs, mismatched options and was-prices below the price", () => {
    const options = [{ name: "Size", values: ["S", "M"] }]
    expect(variantsPayloadSchema.safeParse({ options, variants: [variant, { ...variant, optionValues: ["M"], sku: "a-1" }] }).success).toBe(false)
    expect(variantsPayloadSchema.safeParse({ options, variants: [{ ...variant, optionValues: ["XL"] }] }).success).toBe(false)
    expect(variantsPayloadSchema.safeParse({ options, variants: [{ ...variant, compareAtPrice: "9" }] }).success).toBe(false)
    expect(variantsPayloadSchema.safeParse({ options: [], variants: [{ ...variant, optionValues: [], price: "0" }] }).success).toBe(false)
    expect(variantsPayloadSchema.safeParse({ options: [], variants: [] }).success).toBe(false)
  })
})

describe("catalog URLs", () => {
  const attributes = [attr("c", "x", "colour", { options: ["Red", "Blue"] }), attr("s", "x", "storage", { type: "number", options: [] })]

  it("parses filters, swapping a reversed price range and ignoring unknown values", () => {
    const f = parseFilters({ min: "500", max: "50", "a.colour": ["Red", "Green"], "a.storage.min": "64", sort: "bogus" }, attributes)
    expect(f).toMatchObject({ minPrice: 5000, maxPrice: 50000, sort: "newest", isFiltered: true })
    expect(f.attributes).toEqual([
      { attributeId: "c", kind: "values", values: ["Red"] },
      { attributeId: "s", kind: "range", min: 64, max: undefined },
    ])
    expect(parseFilters({ q: "kente" }, []).sort).toBe("relevance")
    expect(parseFilters({}, []).isFiltered).toBe(false)
  })

  it("builds links that keep filters but reset paging", () => {
    expect(withParams("/c/fashion", { q: "kente", after: "xyz", "a.colour": ["Red", "Blue"] }, { sort: "price_asc" })).toBe(
      "/c/fashion?q=kente&a.colour=Red&a.colour=Blue&sort=price_asc",
    )
    expect(withParams("/c/fashion", { min: "5" }, { min: null })).toBe("/c/fashion")
  })

  it("round-trips cursors and rejects tampered or mismatched ones", () => {
    const cursor = encodeCursor("price_asc", 1250, "p1")
    expect(decodeCursor(cursor, "price_asc")).toEqual({ value: 1250, id: "p1" })
    expect(decodeCursor(cursor, "newest")).toBeNull()
    expect(decodeCursor("not-base64!", "newest")).toBeNull()
    expect(decodeCursor(encodeCursor("newest", "not a date", "p1"), "newest")).toBeNull()
  })
})

describe("misc helpers", () => {
  it("formats amounts for inputs", () => {
    expect(toCediInput(1250)).toBe("12.50")
    expect(toCediInput(5)).toBe("0.05")
    expect(toCediInput(100000)).toBe("1000.00")
  })

  it("makes unique-looking product slugs", () => {
    expect(productSlug("Kente Stole, Gold")).toMatch(/^kente-stole-gold-[a-z0-9]{6}$/)
    expect(productSlug("!!!")).toMatch(/^product-[a-z0-9]{6}$/)
    expect(productSlug("Store")).toMatch(/^store-[a-z0-9]{6}$/)
  })

  it("only accepts real image bytes for photos", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg")
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull()
  })
})
