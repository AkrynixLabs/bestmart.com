import { formatGhs } from "@/lib/money"

/** "GH₵45.00" or "GH₵45.00 – GH₵60.00" */
export function priceRange(min: number, max: number): string {
  if (min === 0 && max === 0) return "No price yet"
  return min === max ? formatGhs(min) : `${formatGhs(min)} – ${formatGhs(max)}`
}
