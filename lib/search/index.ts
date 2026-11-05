import "server-only"

import { postgresCatalogSearch } from "./postgres"
import type { CatalogSearch } from "./types"

/** The active search backend. Swap the implementation here to change engines. */
export const catalogSearch: CatalogSearch = postgresCatalogSearch

export type { AttributeFilter, CatalogQuery, CatalogResult, CatalogSort } from "./types"
