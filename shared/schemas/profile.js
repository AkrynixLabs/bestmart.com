import { z } from 'zod'
import { HttpsUrl, OptionalText } from './common.js'

// `email` is deliberately absent: it belongs to Supabase Auth and the API
// always writes it from the verified token.
export const ProfileUpdate = z.object({
  name: z
    .string({ message: 'Name must be text' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  businessName: OptionalText(120, 'Business name'),
  businessCategory: OptionalText(60, 'Business category'),
  businessAddress: OptionalText(200, 'Business address'),
  storeDescription: OptionalText(1000, 'Store description'),
  phone: OptionalText(30, 'Phone'),
  businessLogo: z.union([z.literal('').transform(() => null), z.null(), HttpsUrl]).optional(),
  isSeller: z.boolean({ message: 'isSeller must be true or false' }).optional(),
})

/** @typedef {z.infer<typeof ProfileUpdate>} ProfileUpdateInput */
