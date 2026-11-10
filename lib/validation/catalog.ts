import { z } from "zod"

import { parseGhs } from "@/lib/money"

import { optionalText, requiredText } from "./common"

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const ATTRIBUTE_KEY_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/

/** Multi-line text: keeps line breaks, trims each line, collapses blank runs. */
export const multilineText = (max: number) =>
  z
    .string()
    .max(max * 2, `Must be ${max} characters or fewer`)
    .transform((v) =>
      v
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    )
    .refine((v) => v.length <= max, `Must be ${max} characters or fewer`)

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true")

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))

const intField = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} must be a whole number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`)

/** "12.5" (percent) -> 1250 basis points; empty -> null (inherit). */
const optionalPercentToBps = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(v) || Number(v) > 100) {
      ctx.addIssue({ code: "custom", message: "Enter a percentage between 0 and 100, e.g. 12.5" })
      return z.NEVER
    }
    return Math.round(Number(v) * 100)
  })

/** Splits "Red, Blue\nGreen" into unique trimmed values, keeping order. */
export function splitList(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input.split(/[,\n]/)) {
    const value = raw.replace(/\s+/g, " ").trim()
    const key = value.toLowerCase()
    if (value && !seen.has(key)) {
      seen.add(key)
      out.push(value)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Admin: categories and attributes
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  name: requiredText("Name", 60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || (SLUG_PATTERN.test(v) && v.length <= 60), "Use lower-case letters, numbers and single hyphens"),
  parentId: optionalId,
  description: optionalText(500),
  status: z.enum(["active", "hidden"]).default("active"),
  commissionPercent: optionalPercentToBps,
  sortOrder: intField("Sort order", 0, 10_000).default(0),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
})

export const ATTRIBUTE_TYPES = [
  ["text", "Text"],
  ["number", "Number"],
  ["select", "Pick one from a list"],
  ["multiselect", "Pick several from a list"],
  ["boolean", "Yes / no"],
] as const

export const attributeSchema = z
  .object({
    name: requiredText("Name", 40),
    key: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || (ATTRIBUTE_KEY_PATTERN.test(v) && v.length <= 40), "Use lower-case letters, numbers and single underscores"),
    type: z.enum(["text", "number", "select", "multiselect", "boolean"], { error: "Choose a type" }),
    unit: optionalText(12),
    options: z
      .string()
      .optional()
      .transform((v) => splitList(v ?? "")),
    isRequired: checkbox,
    isFilterable: checkbox,
    sortOrder: intField("Sort order", 0, 10_000).default(0),
  })
  .superRefine((value, ctx) => {
    const isList = value.type === "select" || value.type === "multiselect"
    if (isList && value.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least two choices, separated by commas" })
    if (isList && value.options.length > 100) ctx.addIssue({ code: "custom", path: ["options"], message: "At most 100 choices" })
    if (value.options.some((o) => o.length > 40)) ctx.addIssue({ code: "custom", path: ["options"], message: "Each choice must be 40 characters or fewer" })
  })
  .transform((value) => ({
    ...value,
    options: value.type === "select" || value.type === "multiselect" ? value.options : [],
    unit: value.type === "number" ? value.unit : undefined,
  }))

/** "Screen size (inches)" -> "screen_size_inches" */
export function attributeKeyFrom(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40)
      .replace(/_+$/g, "") || "attribute"
  )
}

export const categorySuggestionSchema = z.object({
  name: requiredText("Category name", 60),
  parentId: optionalId,
  note: optionalText(500),
})

export const reviewSuggestionSchema = z.object({
  suggestionId: z.string().min(1),
  response: optionalText(500),
})

// ---------------------------------------------------------------------------
// Seller: products
// ---------------------------------------------------------------------------

export const MAX_PRODUCT_IMAGES = 8
export const MAX_OPTIONS = 3
export const MAX_OPTION_VALUES = 30
export const MAX_VARIANTS = 100
export const MAX_STOCK = 1_000_000
export const MAX_PRICE_PESEWAS = 100_000_000 // GHS 1,000,000

export const newProductSchema = z.object({
  title: requiredText("Product name", 120).refine((v) => v.length >= 3, "Product name must be at least 3 characters"),
  categoryId: z.string({ error: "Choose a category" }).trim().min(1, "Choose a category"),
})

export const productDetailsSchema = z.object({
  title: requiredText("Product name", 120).refine((v) => v.length >= 3, "Product name must be at least 3 characters"),
  description: multilineText(5000),
})

const ghsAmount = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const pesewas = parseGhs(v)
      if (pesewas === null || pesewas <= 0) {
        ctx.addIssue({ code: "custom", message: `${label}: enter an amount in cedis, e.g. 49.99` })
        return z.NEVER
      }
      if (pesewas > MAX_PRICE_PESEWAS) {
        ctx.addIssue({ code: "custom", message: `${label} is too high` })
        return z.NEVER
      }
      return pesewas
    })

const optionSchema = z.object({
  name: requiredText("Option name", 30),
  values: z
    .array(z.string().trim().min(1).max(30, "Option values must be 30 characters or fewer"))
    .min(1, "Each option needs at least one value")
    .max(MAX_OPTION_VALUES, `At most ${MAX_OPTION_VALUES} values per option`),
})

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z
    .string()
    .trim()
    .min(1, "Every variant needs a SKU")
    .max(64, "SKUs must be 64 characters or fewer")
    .regex(/^[A-Za-z0-9._\-/]+$/, "SKUs can use letters, numbers and . _ - /"),
  optionValues: z.array(z.string()),
  price: ghsAmount("Price"),
  compareAtPrice: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(ghsAmount("Was-price").optional()),
  stock: z.coerce.number({ error: "Stock must be a whole number" }).int("Stock must be a whole number").min(0, "Stock can't be negative").max(MAX_STOCK),
  isActive: z.boolean().default(true),
})

export type VariantInput = z.input<typeof variantSchema>

/** The options + variants editor posts one JSON document. */
export const variantsPayloadSchema = z
  .object({
    options: z.array(optionSchema).max(MAX_OPTIONS, `At most ${MAX_OPTIONS} options`),
    variants: z.array(variantSchema).min(1, "Add at least one variant").max(MAX_VARIANTS, `At most ${MAX_VARIANTS} variants`),
  })
  .superRefine(({ options, variants }, ctx) => {
    const names = options.map((o) => o.name.toLowerCase())
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Option names must be different" })
    for (const [i, option] of options.entries()) {
      const values = option.values.map((v) => v.toLowerCase())
      if (new Set(values).size !== values.length) ctx.addIssue({ code: "custom", path: ["options", i], message: `"${option.name}" has a repeated value` })
    }
    const skus = new Set<string>()
    const combos = new Set<string>()
    for (const [i, variant] of variants.entries()) {
      if (variant.optionValues.length !== options.length || variant.optionValues.some((v, j) => !options[j]?.values.includes(v))) {
        ctx.addIssue({ code: "custom", path: ["variants", i], message: "A variant doesn't match the options. Regenerate the variants." })
      }
      const sku = variant.sku.toLowerCase()
      if (skus.has(sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: `SKU "${variant.sku}" is used twice` })
      skus.add(sku)
      const combo = JSON.stringify(variant.optionValues)
      if (combos.has(combo)) ctx.addIssue({ code: "custom", path: ["variants", i], message: "Two variants have the same options" })
      combos.add(combo)
      if (variant.compareAtPrice !== undefined && variant.compareAtPrice <= variant.price) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "compareAtPrice"], message: "The was-price must be higher than the price" })
      }
    }
  })

export type VariantsPayload = z.output<typeof variantsPayloadSchema>

export const blockProductSchema = z.object({
  productId: z.string().min(1),
  reason: requiredText("Reason", 500),
})
