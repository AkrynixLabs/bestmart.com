import { z } from "zod"

import { ghanaCardNumber, ghanaPhone, ghanaRegion, optionalText, requiredText } from "./common"

export const MOBILE_MONEY_PROVIDERS = ["MTN", "Telecel", "AirtelTigo"] as const

export const sellerApplicationSchema = z
  .object({
    storeName: requiredText("Store name", 80).refine((v) => v.length >= 3, "Store name must be at least 3 characters"),
    businessType: z.enum(["individual", "registered_business"], { error: "Choose a business type" }),
    businessRegistrationNumber: optionalText(40),
    ghanaCardNumber,
    phone: ghanaPhone,
    region: ghanaRegion,
    city: requiredText("Town or city", 80),
    categoriesNote: optionalText(500),
    payoutMethod: z.enum(["mobile_money", "bank_account"], { error: "Choose how you want to be paid" }),
    payoutProvider: requiredText("Provider", 80),
    payoutAccountName: requiredText("Account name", 100),
    payoutAccountNumber: z
      .string({ error: "Account number is required" })
      .trim()
      .transform((v) => v.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(/^\d{6,20}$/, "Enter digits only (6 to 20)")),
    agreeToSellerTerms: z.literal("on", { error: "You need to agree to the seller terms" }),
  })
  .superRefine((d, ctx) => {
    if (d.businessType === "registered_business" && !d.businessRegistrationNumber) {
      ctx.addIssue({ code: "custom", path: ["businessRegistrationNumber"], message: "Enter your business registration number" })
    }
    if (d.payoutMethod === "mobile_money") {
      if (!(MOBILE_MONEY_PROVIDERS as readonly string[]).includes(d.payoutProvider)) {
        ctx.addIssue({ code: "custom", path: ["payoutProvider"], message: "Choose MTN, Telecel or AirtelTigo" })
      }
      if (!/^0[235]\d{8}$/.test(d.payoutAccountNumber)) {
        ctx.addIssue({ code: "custom", path: ["payoutAccountNumber"], message: "Enter the 10-digit MoMo number, e.g. 0241234567" })
      }
    }
  })

export const rejectApplicationSchema = z.object({
  applicationId: z.string().min(1),
  reason: requiredText("Reason", 500),
})

// Ghana Card image upload rules.
export const KYC_MAX_BYTES = 5 * 1024 * 1024
export const KYC_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const

/** Checks the file's leading bytes, so a renamed file can't pass as an image. */
export function sniffKycType(bytes: Uint8Array): (typeof KYC_ALLOWED_TYPES)[number] | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg"
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png"
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp"
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"
  return null
}
