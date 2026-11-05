// Turns URL search params into a catalog query and back. Pure, so the same
// parsing runs for pages, links and tests.
//
//   ?q=kente&sort=price_asc&min=50&max=500&a.colour=Red&a.colour=Blue&a.storage.min=64&after=...

import { parseGhs } from "@/lib/money"
import type { AttributeFilter, CatalogSort } from "@/lib/search/types"

import type { TreeAttribute } from "./tree"

export type SearchParams = Record<string, string | string[] | undefined>

export const SORTS: { value: CatalogSort; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
]

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const all = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v])

export type ParsedFilters = {
  text?: string
  sort: CatalogSort
  minPrice?: number
  maxPrice?: number
  attributes: AttributeFilter[]
  after?: string
  page?: number
  /** True when anything beyond the defaults is applied (for "clear filters" and noindex). */
  isFiltered: boolean
}

export function parseFilters(params: SearchParams, filterable: TreeAttribute[]): ParsedFilters {
  const text = first(params.q)?.trim().slice(0, 100) || undefined
  const requested = first(params.sort)
  const sort: CatalogSort = SORTS.some((s) => s.value === requested) ? (requested as CatalogSort) : text ? "relevance" : "newest"
  const price = (v: string | undefined) => {
    const pesewas = v ? parseGhs(v) : null
    return pesewas === null ? undefined : pesewas
  }
  let minPrice = price(first(params.min))
  let maxPrice = price(first(params.max))
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice]

  const attributes: AttributeFilter[] = []
  for (const attribute of filterable) {
    const field = `a.${attribute.key}`
    if (attribute.type === "number") {
      const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined)
      const min = num(first(params[`${field}.min`]))
      const max = num(first(params[`${field}.max`]))
      if (min !== undefined || max !== undefined) attributes.push({ attributeId: attribute.id, kind: "range", min, max })
    } else if (attribute.type === "boolean") {
      const v = first(params[field])
      if (v === "yes" || v === "no") attributes.push({ attributeId: attribute.id, kind: "boolean", value: v === "yes" })
    } else {
      const raw = all(params[field])
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 20)
      const values = attribute.type === "text" ? raw.map((v) => v.slice(0, 120)) : attribute.options.filter((o) => raw.includes(o))
      if (values.length > 0) attributes.push({ attributeId: attribute.id, kind: "values", values })
    }
  }

  const after = first(params.after)?.slice(0, 200) || undefined
  const pageNumber = Number(first(params.page))
  const page = Number.isInteger(pageNumber) && pageNumber > 1 ? pageNumber : undefined
  const isFiltered = Boolean(text || first(params.sort) || minPrice !== undefined || maxPrice !== undefined || attributes.length || after || page)
  return { text, sort, minPrice, maxPrice, attributes, after, page, isFiltered }
}

/** Builds a URL that keeps the current params, applies `changes`, and resets paging. */
export function withParams(pathname: string, params: SearchParams, changes: Record<string, string | string[] | null>): string {
  const out = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key === "after" || key === "page" || key in changes) continue
    for (const v of all(value)) out.append(key, v)
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) continue
    for (const v of Array.isArray(value) ? value : [value]) if (v !== "") out.append(key, v)
  }
  const query = out.toString()
  return query ? `${pathname}?${query}` : pathname
}
