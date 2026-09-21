import { z } from 'zod'

// Building blocks shared by the API (authoritative validation) and the web
// app (instant form feedback). The server never trusts that the client ran
// these: every write route validates again.

export const MAX_MONEY = 10_000_000

/** Positive integer id (bigint identity columns), from a number or numeric string. */
export const Id = z.coerce
  .number({ message: 'Invalid id' })
  .int('Invalid id')
  .positive('Invalid id')
  .max(Number.MAX_SAFE_INTEGER, 'Invalid id')

export const Uuid = z.uuid({ message: 'Invalid id' })

/** Money in cedis from a number or numeric string, rounded to pesewas. */
export const Money = z.coerce
  .number({ message: 'Enter a valid amount' })
  .refine((n) => Number.isFinite(n) && n > 0 && n < MAX_MONEY, 'Enter a valid amount')
  .transform((n) => Math.round(n * 100) / 100)

export const HttpsUrl = z
  .string()
  .max(2048, 'URL is too long')
  .refine((value) => value.startsWith('https://'), 'Must be an uploaded image URL')

/**
 * Optional free text: trimmed, '' and null both become null, undefined
 * means "not provided" (left unchanged on update).
 * @param {number} max
 * @param {string} label
 */
export const OptionalText = (max, label) =>
  z
    .string({ message: `${label} must be text` })
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null))
