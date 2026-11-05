// The contract between catalog pages and the search backend. Pages build a
// CatalogQuery and get product ids back in order; a different engine
// (Typesense, Meilisearch, ...) only has to implement CatalogSearch.

export type CatalogSort = "relevance" | "newest" | "price_asc" | "price_desc"

export type AttributeFilter =
  | { attributeId: string; kind: "values"; values: string[] } // text, select, multiselect: match any
  | { attributeId: string; kind: "range"; min?: number; max?: number } // number
  | { attributeId: string; kind: "boolean"; value: boolean }

export type CatalogQuery = {
  /** Visible category ids to search within (already includes subcategories). */
  categoryIds: string[]
  storeId?: string
  text?: string
  minPrice?: number // pesewas
  maxPrice?: number // pesewas
  attributes?: AttributeFilter[]
  sort: CatalogSort
  /** Opaque cursor from a previous page (keyset sorts). */
  after?: string
  /** 1-based page number (relevance sort only, capped). */
  page?: number
  limit: number
}

export type CatalogResult = {
  ids: string[]
  /** Pass as `after` for the next page (keyset sorts), or null at the end. */
  nextCursor: string | null
  /** Next page number for relevance sort, or null at the end. */
  nextPage: number | null
}

export interface CatalogSearch {
  query(query: CatalogQuery): Promise<CatalogResult>
}
