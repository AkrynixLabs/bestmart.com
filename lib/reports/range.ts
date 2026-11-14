// Report date ranges (pure). Days are Ghana days (GMT, so UTC midnight).
// `to` is exclusive: a range for 1–30 Nov runs to 1 Dec 00:00.

export type ReportRange = { from: Date; to: Date; fromInput: string; toInput: string; label: string }

const DAY = 24 * 60 * 60 * 1000
const MAX_DAYS = 366
const iso = (d: Date) => d.toISOString().slice(0, 10)
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

export const PRESETS = [
  { key: "last_7", label: "Last 7 days" },
  { key: "last_30", label: "Last 30 days" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
] as const

function build(from: Date, toInclusive: Date, label: string): ReportRange {
  return { from, to: new Date(toInclusive.getTime() + DAY), fromInput: iso(from), toInput: iso(toInclusive), label }
}

function preset(key: string, now: Date): ReportRange | null {
  const today = startOfDay(now)
  switch (key) {
    case "last_7":
      return build(new Date(today.getTime() - 6 * DAY), today, "Last 7 days")
    case "last_30":
      return build(new Date(today.getTime() - 29 * DAY), today, "Last 30 days")
    case "this_month":
      return build(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), today, "This month")
    case "last_month": {
      const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
      const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))
      return build(first, last, "Last month")
    }
    default:
      return null
  }
}

/** From ?preset= or ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive); defaults to the last 30 days. */
export function parseRange(params: { preset?: string; from?: string; to?: string }, now = new Date()): ReportRange {
  if (params.preset) {
    const p = preset(params.preset, now)
    if (p) return p
  }
  const parse = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? new Date(`${v}T00:00:00Z`) : null)
  let from = parse(params.from)
  let to = parse(params.to)
  if (from && to) {
    if (from > to) [from, to] = [to, from]
    if ((to.getTime() - from.getTime()) / DAY + 1 > MAX_DAYS) from = new Date(to.getTime() - (MAX_DAYS - 1) * DAY)
    return build(from, to, `${iso(from)} to ${iso(to)}`)
  }
  return preset("last_30", now)!
}

/** Every day in the range, for a complete daily table (days with no sales included). */
export function daysIn(range: Pick<ReportRange, "from" | "to">): string[] {
  const out: string[] = []
  for (let t = range.from.getTime(); t < range.to.getTime(); t += DAY) out.push(iso(new Date(t)))
  return out
}
