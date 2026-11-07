// Distance-based delivery fees. Pure (no database), so it's unit-tested and
// can later be swapped for real road distances behind quoteDelivery().
//
//   km  = straight-line distance between the two points x road factor
//   fee = the first band whose upToKm >= km (the last band has no limit)
//
// Points come from map pins when both sides have one; otherwise from the
// neighbourhood, town or regional-capital centre (lib/delivery/places.ts).

import { z } from "zod"

import type { GhanaRegionValue } from "@/lib/validation/common"

import { PLACES, REGION_CAPITAL, type Place } from "./places"

export type DistanceSource = "pins" | "area" | "town" | "region"

export type Band = { upToKm: number | null; feePesewas: number }

export const DEFAULT_BANDS: Band[] = [
  { upToKm: 5, feePesewas: 1500 },
  { upToKm: 10, feePesewas: 2000 },
  { upToKm: 20, feePesewas: 3000 },
  { upToKm: 40, feePesewas: 4500 },
  { upToKm: 100, feePesewas: 7000 },
  { upToKm: 300, feePesewas: 10000 },
  { upToKm: null, feePesewas: 14000 },
]

export const bandsSchema = z
  .array(
    z.object({
      upToKm: z.number().positive().max(2000).nullable(),
      feePesewas: z.number().int().min(0).max(10_000_000),
    }),
  )
  .min(1, "Add at least one band")
  .max(20, "At most 20 bands")
  .superRefine((bands, ctx) => {
    bands.forEach((band, i) => {
      const last = i === bands.length - 1
      if (last && band.upToKm !== null) ctx.addIssue({ code: "custom", path: [i, "upToKm"], message: "The last band must have no upper limit" })
      if (!last && band.upToKm === null) ctx.addIssue({ code: "custom", path: [i, "upToKm"], message: "Only the last band can have no upper limit" })
      const prev = bands[i - 1]
      if (prev && prev.upToKm !== null && band.upToKm !== null && band.upToKm <= prev.upToKm) {
        ctx.addIssue({ code: "custom", path: [i, "upToKm"], message: "Distances must go up from one band to the next" })
      }
    })
  })

/** Bands from the settings JSON; falls back to the defaults if the stored value is unusable. */
export function readBands(value: unknown): Band[] {
  const parsed = bandsSchema.safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_BANDS
}

export function feeForKm(bands: Band[], km: number): number {
  for (const band of bands) if (band.upToKm === null || km <= band.upToKm) return band.feePesewas
  return bands.at(-1)!.feePesewas
}

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

// ---------------------------------------------------------------------------
// Resolving a location to a point
// ---------------------------------------------------------------------------

const normalise = (s: string) =>
  ` ${s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `

const INDEX: { key: string; place: Place }[] = PLACES.flatMap((place) => [place.name, ...(place.aliases ?? [])].map((name) => ({ key: normalise(name), place }))).sort(
  // Longest names first, so "East Legon" wins over "Legon" and "Tema Community 25" over "Tema".
  (a, b) => b.key.length - a.key.length,
)

/** The best-known place whose name appears (as whole words) in the text. */
export function findPlace(text: string | null | undefined, region?: GhanaRegionValue): Place | null {
  if (!text?.trim()) return null
  const hay = normalise(text)
  const matches = INDEX.filter((entry) => hay.includes(entry.key))
  // Prefer a match in the address's own region (some names repeat across regions).
  return (region && matches.find((m) => m.place.region === region)?.place) || matches[0]?.place || null
}

export type LocationInput = {
  latitude?: number | null
  longitude?: number | null
  area?: string | null
  city?: string | null
  region: GhanaRegionValue
}

export type ResolvedPoint = { lat: number; lng: number; source: DistanceSource; label: string }

export function resolvePoint(loc: LocationInput): ResolvedPoint {
  if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
    return { lat: loc.latitude, lng: loc.longitude, source: "pins", label: "map pin" }
  }
  const byArea = findPlace(loc.area, loc.region)
  if (byArea) return { lat: byArea.lat, lng: byArea.lng, source: byArea.kind === "area" ? "area" : "town", label: byArea.name }
  const byCity = findPlace(loc.city, loc.region)
  if (byCity) return { lat: byCity.lat, lng: byCity.lng, source: byCity.kind === "area" ? "area" : "town", label: byCity.name }
  const capital = PLACES.find((p) => p.name === REGION_CAPITAL[loc.region])!
  return { lat: capital.lat, lng: capital.lng, source: "region", label: capital.name }
}

const QUALITY: DistanceSource[] = ["pins", "area", "town", "region"]

export type DeliveryQuote = { km: number; feePesewas: number; source: DistanceSource }

/** The delivery fee from a seller's pickup point to a buyer's address. */
export function quoteDelivery(from: LocationInput, to: LocationInput, bands: Band[], roadFactorPct: number): DeliveryQuote {
  const a = resolvePoint(from)
  const b = resolvePoint(to)
  // The estimate is only as good as its weaker end.
  const source = QUALITY[Math.max(QUALITY.indexOf(a.source), QUALITY.indexOf(b.source))]!
  const km = Math.round(haversineKm(a, b) * (roadFactorPct / 100) * 10) / 10
  return { km, feePesewas: feeForKm(bands, km), source }
}

/** Shopper-facing wording for how the distance was worked out. */
export function describeQuote(q: Pick<DeliveryQuote, "km" | "source">): string {
  const km = q.km < 1 ? "under 1 km" : `about ${Math.round(q.km)} km`
  if (q.source === "pins") return km
  if (q.source === "region") return `${km}, estimated between regions`
  return `${km}, estimated between ${q.source === "area" ? "neighbourhoods" : "towns"}`
}
