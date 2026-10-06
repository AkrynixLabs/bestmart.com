// Money is always handled as integer pesewas (1 GHS = 100 pesewas) so sums
// and percentages never pick up floating-point drift. Convert to cedis only
// for display, and from cedis only at the input boundary.

export type Pesewas = number

const formatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  currencyDisplay: "symbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function assertPesewas(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Expected an integer amount in pesewas, got ${amount}`)
  }
}

/** 1250 -> "GH₵12.50" */
export function formatGhs(amount: Pesewas): string {
  assertPesewas(amount)
  return formatter.format(amount / 100)
}

/**
 * Parses a cedi amount typed by a person ("12.5", "1,200.00") into pesewas.
 * Returns null for anything that isn't a non-negative amount with at most
 * two decimal places.
 */
export function parseGhs(input: string): Pesewas | null {
  const cleaned = input.trim().replace(/,/g, "").replace(/^(GH₵|GHS|₵)\s*/i, "")
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole = "0", fraction = ""] = cleaned.split(".")
  const pesewas = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  return Number.isSafeInteger(pesewas) ? pesewas : null
}

/**
 * Applies a rate in basis points (1000 = 10%) and rounds half-up to the
 * nearest pesewa. Used for commission.
 */
export function applyBps(amount: Pesewas, bps: number): Pesewas {
  assertPesewas(amount)
  if (!Number.isInteger(bps) || bps < 0) throw new RangeError(`Invalid basis points: ${bps}`)
  return Math.floor((amount * bps + 5000) / 10000)
}
