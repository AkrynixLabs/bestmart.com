// Pure review rules (unit-tested).

export const MAX_REVIEW_LENGTH = 2000

export function validRating(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}

/** Average rounded to one decimal (as stored and shown), or null without reviews. */
export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null
  return Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
}

/** Share of reviews per star, 5 down to 1, for the bar chart on product pages. */
export function distribution(counts: Partial<Record<number, number>>): { stars: number; count: number; percent: number }[] {
  const total = [1, 2, 3, 4, 5].reduce((s, k) => s + (counts[k] ?? 0), 0)
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = counts[stars] ?? 0
    return { stars, count, percent: total === 0 ? 0 : Math.round((count / total) * 100) }
  })
}

/** "Ama M." from "Ama Mensah": reviews show first name and initial only. */
export function reviewerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "A buyer"
  return parts.length === 1 ? parts[0]! : `${parts[0]} ${parts.at(-1)![0]!.toUpperCase()}.`
}
