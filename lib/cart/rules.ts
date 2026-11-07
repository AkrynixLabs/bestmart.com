// Pure cart rules, shared by the cart, checkout and tests.

export const MAX_LINE_QUANTITY = 20
export const MAX_CART_LINES = 50

export type LineProblem = "unavailable" | "out_of_stock" | "not_enough_stock"

/** Why a line can't be bought as it stands (null = fine). */
export function lineProblem(line: { quantity: number; stock: number; purchasable: boolean }): LineProblem | null {
  if (!line.purchasable) return "unavailable"
  if (line.stock <= 0) return "out_of_stock"
  if (line.quantity > line.stock) return "not_enough_stock"
  return null
}

export const problemText: Record<LineProblem, string> = {
  unavailable: "No longer available",
  out_of_stock: "Sold out",
  not_enough_stock: "Not enough in stock",
}

/** Combining a guest cart into an account cart: quantities add up, capped. */
export function mergeQuantities(into: Map<string, number>, from: Map<string, number>): Map<string, number> {
  const out = new Map(into)
  for (const [variantId, qty] of from) out.set(variantId, Math.min(MAX_LINE_QUANTITY, (out.get(variantId) ?? 0) + qty))
  return out
}

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ" // Crockford base32: no I, L, O, U

/** "BM-261118-7K3Q9": date for humans, 5 random characters (33 million per day) for uniqueness. */
export function orderNumber(now: Date, random: (n: number) => Uint8Array): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, "")
  const suffix = Array.from(random(5), (b) => ALPHABET[b % 32]).join("")
  return `BM-${date}-${suffix}`
}
