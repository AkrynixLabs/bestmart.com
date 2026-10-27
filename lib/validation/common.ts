import { z } from "zod"

/** Collapses whitespace and trims; empty strings become undefined. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((v) => v.replace(/\s+/g, " "))
    .optional()
    .transform((v) => (v ? v : undefined))

export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((v) => v.replace(/\s+/g, " "))

/**
 * Ghanaian phone numbers in any common format ("024 123 4567",
 * "+233 24 123 4567", "233241234567") normalised to E.164: "+233241234567".
 */
export function normaliseGhanaPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "")
  const match = /^(?:\+?233|0)([235]\d{8})$/.exec(digits)
  return match ? `+233${match[1]}` : null
}

export const ghanaPhone = z
  .string({ error: "Phone number is required" })
  .trim()
  .min(1, "Phone number is required")
  .transform((value, ctx) => {
    const normalised = normaliseGhanaPhone(value)
    if (!normalised) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Ghanaian phone number, e.g. 024 123 4567" })
      return z.NEVER
    }
    return normalised
  })

/** GhanaPost GPS digital address, e.g. "GA-123-4567" (upper-cased). */
export const ghanaPostGps = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}-\d{3,4}-\d{4}$/, "Use the GhanaPost GPS format, e.g. GA-123-4567")

/** Ghana Card (NIA) number, e.g. "GHA-123456789-0" (upper-cased). */
export const ghanaCardNumber = z
  .string({ error: "Ghana Card number is required" })
  .trim()
  .toUpperCase()
  .regex(/^GHA-\d{9}-\d$/, "Use the format on your card, e.g. GHA-123456789-0")

export const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .pipe(z.email("Enter a valid email address"))

export const ghanaRegions = [
  ["greater_accra", "Greater Accra"],
  ["ashanti", "Ashanti"],
  ["western", "Western"],
  ["western_north", "Western North"],
  ["central", "Central"],
  ["eastern", "Eastern"],
  ["volta", "Volta"],
  ["oti", "Oti"],
  ["northern", "Northern"],
  ["savannah", "Savannah"],
  ["north_east", "North East"],
  ["upper_east", "Upper East"],
  ["upper_west", "Upper West"],
  ["bono", "Bono"],
  ["bono_east", "Bono East"],
  ["ahafo", "Ahafo"],
] as const

export type GhanaRegionValue = (typeof ghanaRegions)[number][0]
export const regionLabel = Object.fromEntries(ghanaRegions) as Record<GhanaRegionValue, string>
export const ghanaRegion = z.enum(ghanaRegions.map(([value]) => value) as [GhanaRegionValue, ...GhanaRegionValue[]], {
  error: "Choose a region",
})

/** Field-level errors in the shape forms render: { fieldName: "message" }. */
export type FieldErrors = Partial<Record<string, string>>

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form"
    out[key] ??= issue.message
  }
  return out
}
