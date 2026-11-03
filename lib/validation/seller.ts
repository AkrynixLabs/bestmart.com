import { z } from "zod"

import { ghanaCardNumber, ghanaPhone, ghanaRegion, optionalText, requiredText } from "./common"
import { MAX_UPLOAD_BYTES, sniffFileType } from "./files"

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

// Ghana Card upload rules. Photos are shrunk in the browser before upload.
export const KYC_MAX_BYTES = MAX_UPLOAD_BYTES
export const KYC_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const

/** Checks the file's leading bytes, so a renamed file can't pass as an image. */
export const sniffKycType = sniffFileType
