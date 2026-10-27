import { z } from "zod"

import { ghanaPhone, ghanaPostGps, ghanaRegion, optionalText, requiredText } from "./common"

export const addressSchema = z.object({
  label: optionalText(40),
  recipientName: requiredText("Recipient name", 100),
  phone: ghanaPhone,
  region: ghanaRegion,
  city: requiredText("Town or city", 80),
  area: requiredText("Area or suburb", 80),
  streetAddress: optionalText(160),
  landmark: optionalText(160),
  gpsAddress: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(ghanaPostGps.optional()),
  isDefault: z
    .string()
    .optional()
    .transform((v) => v === "on"),
})

export type AddressInput = z.infer<typeof addressSchema>
