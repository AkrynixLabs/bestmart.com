// Pure product rules: variant generation, price/stock aggregates, attribute
// values and the publish checklist. No database or Node APIs: the variant
// editor runs parts of it in the browser.

import type { TreeAttribute } from "./tree"

export type ProductOption = { name: string; values: string[] }

/** Every combination of option values, in option order. No options -> one empty combination. */
export function combinations(options: ProductOption[]): string[][] {
  return options.reduce<string[][]>((acc, option) => acc.flatMap((combo) => option.values.map((value) => [...combo, value])), [[]])
}

/** Parses the `options` JSON column defensively (older or hand-edited rows). */
export function readOptions(value: unknown): ProductOption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((o) =>
    o && typeof o === "object" && typeof o.name === "string" && Array.isArray(o.values)
      ? [{ name: o.name, values: o.values.filter((v: unknown): v is string => typeof v === "string") }]
      : [],
  )
}

type PricedVariant = { price: number; stock: number; isActive: boolean }

/** Listing columns kept on the product row, from its active variants. */
export function aggregates(variants: PricedVariant[]): { minPrice: number; maxPrice: number; totalStock: number } {
  const active = variants.filter((v) => v.isActive)
  if (active.length === 0) return { minPrice: 0, maxPrice: 0, totalStock: 0 }
  const prices = active.map((v) => v.price)
  return { minPrice: Math.min(...prices), maxPrice: Math.max(...prices), totalStock: active.reduce((sum, v) => sum + v.stock, 0) }
}

/** A readable default SKU: "KENTE-STOLE-RED-M". Sellers can overwrite it. */
export function suggestSku(title: string, optionValues: string[]): string {
  const part = (s: string, n: number) =>
    s
      .normalize("NFKD")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, n)
      .replace(/-+$/g, "")
  return [part(title, 20) || "ITEM", ...optionValues.map((v) => part(v, 12))].filter(Boolean).join("-")
}

// ---------------------------------------------------------------------------
// Attribute values
// ---------------------------------------------------------------------------

export type AttributeValueInput = { attributeId: string; textValues: string[]; numberValue: number | null; booleanValue: boolean | null }

/** Form field name for an attribute input. */
export const attributeField = (key: string) => `attr.${key}`

/**
 * Reads attribute inputs from a form. Empty inputs are skipped (drafts may be
 * incomplete; required attributes are checked when publishing).
 */
export function parseAttributeValues(
  attributes: TreeAttribute[],
  getAll: (name: string) => string[],
): { values: AttributeValueInput[]; errors: Record<string, string> } {
  const values: AttributeValueInput[] = []
  const errors: Record<string, string> = {}
  for (const attribute of attributes) {
    const field = attributeField(attribute.key)
    const raw = getAll(field)
      .map((v) => v.replace(/\s+/g, " ").trim())
      .filter(Boolean)
    if (raw.length === 0) continue
    const base = { attributeId: attribute.id, textValues: [] as string[], numberValue: null as number | null, booleanValue: null as boolean | null }
    switch (attribute.type) {
      case "text": {
        const text = raw[0]!
        if (text.length > 120) errors[field] = `${attribute.name} must be 120 characters or fewer`
        else values.push({ ...base, textValues: [text] })
        break
      }
      case "number": {
        const n = Number(raw[0]!.replace(/,/g, ""))
        if (!Number.isFinite(n) || Math.abs(n) > 1e9) errors[field] = `${attribute.name} must be a number`
        else values.push({ ...base, numberValue: n })
        break
      }
      case "select": {
        if (!attribute.options.includes(raw[0]!)) errors[field] = `Choose one of the listed ${attribute.name.toLowerCase()} options`
        else values.push({ ...base, textValues: [raw[0]!] })
        break
      }
      case "multiselect": {
        const picked = attribute.options.filter((o) => raw.includes(o))
        if (picked.length !== new Set(raw).size) errors[field] = `Choose from the listed ${attribute.name.toLowerCase()} options`
        else values.push({ ...base, textValues: picked })
        break
      }
      case "boolean": {
        if (raw[0] === "yes" || raw[0] === "no") values.push({ ...base, booleanValue: raw[0] === "yes" })
        else errors[field] = `Choose yes or no for ${attribute.name.toLowerCase()}`
        break
      }
    }
  }
  return { values, errors }
}

/** Human-readable value for the product page's specification table. */
export function formatAttributeValue(attribute: Pick<TreeAttribute, "type" | "unit">, value: Omit<AttributeValueInput, "attributeId">): string {
  if (attribute.type === "boolean") return value.booleanValue ? "Yes" : "No"
  if (attribute.type === "number") return value.numberValue === null ? "" : `${value.numberValue.toLocaleString("en-GH")}${attribute.unit ? ` ${attribute.unit}` : ""}`
  return value.textValues.join(", ")
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export type PublishCheckInput = {
  title: string
  description: string
  categoryListable: boolean
  imageCount: number
  variants: PricedVariant[]
  requiredAttributes: Pick<TreeAttribute, "id" | "name">[]
  filledAttributeIds: string[]
}

/** What still blocks publishing (empty = ready). Shown to the seller as a checklist. */
export function publishProblems(input: PublishCheckInput): string[] {
  const problems: string[] = []
  if (input.title.trim().length < 3) problems.push("Give the product a name.")
  if (input.description.trim().length < 20) problems.push("Write a description of at least 20 characters.")
  if (!input.categoryListable) problems.push("Move the product to an available category (this one is hidden or has subcategories).")
  if (input.imageCount === 0) problems.push("Add at least one photo.")
  if (!input.variants.some((v) => v.isActive)) problems.push("Add at least one active variant with a price.")
  const filled = new Set(input.filledAttributeIds)
  for (const attribute of input.requiredAttributes) {
    if (!filled.has(attribute.id)) problems.push(`Fill in "${attribute.name}".`)
  }
  return problems
}
