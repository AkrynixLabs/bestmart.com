// Pure payout rules (unit-tested): Paystack codes for Ghana MoMo networks,
// matching a typed bank name to Paystack's bank list, the weekly schedule.

import type { Bank } from "@/lib/payments/types"

/** Paystack's bank codes for Ghana mobile money networks. */
export const MOMO_CODES: Record<string, string> = { MTN: "MTN", Telecel: "VOD", AirtelTigo: "ATL" }

const normalise = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(limited|ltd|plc|company|co|ghana|gh)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `

/**
 * Finds the bank a seller typed ("GCB", "Ecobank", "Stanbic Bank") in
 * Paystack's list. Returns null when there's no single clear match, so an
 * admin chooses instead of money going to the wrong bank.
 */
export function matchBank(typed: string, banks: Bank[]): Bank | null {
  const want = normalise(typed)
  if (want.trim().length < 2) return null
  const exact = banks.filter((b) => normalise(b.name) === want)
  if (exact.length === 1) return exact[0]!
  const containing = banks.filter((b) => normalise(b.name).includes(want) || want.includes(normalise(b.name)))
  return containing.length === 1 ? containing[0]! : null
}

/** The payout details a recipient was created for; a change means a new recipient. */
export function recipientKey(d: { payoutMethod: string; bankCode: string; payoutAccountNumber: string; payoutAccountName: string }): string {
  return [d.payoutMethod, d.bankCode, d.payoutAccountNumber, d.payoutAccountName.trim().toLowerCase()].join("|")
}

/** Ghana runs on GMT all year, so the UTC weekday is the local weekday. */
export function isPayoutDay(now: Date, weekday: number): boolean {
  return now.getUTCDay() === weekday
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const

/** "PO-261124-ab12cd34ef": date for humans, random part for uniqueness. */
export function payoutReference(now: Date, random: string): string {
  return `PO-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${random}`
}

/** "0241234567" -> "•••••• 4567" */
export function maskAccount(number: string): string {
  return number.length <= 4 ? number : `${"•".repeat(Math.min(6, number.length - 4))} ${number.slice(-4)}`
}
