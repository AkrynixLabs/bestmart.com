// Opaque keyset cursors: base64url of [sort, value, id]. A cursor from a
// different sort (or a tampered one) is ignored, which restarts at page 1.

import type { CatalogSort } from "./types"

export type Cursor = { value: string | number; id: string }

export function encodeCursor(sort: CatalogSort, value: string | number, id: string): string {
  return Buffer.from(JSON.stringify([sort, value, id])).toString("base64url")
}

export function decodeCursor(raw: string | undefined, sort: CatalogSort): Cursor | null {
  if (!raw || raw.length > 200) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))
    if (!Array.isArray(parsed) || parsed.length !== 3) return null
    const [cursorSort, value, id] = parsed as unknown[]
    if (cursorSort !== sort || typeof id !== "string" || id.length > 40) return null
    if (sort === "newest") {
      return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? { value, id } : null
    }
    if (sort === "rating") return typeof value === "number" && value >= 0 && value <= 5 ? { value, id } : null
    return typeof value === "number" && Number.isSafeInteger(value) ? { value, id } : null
  } catch {
    return null
  }
}
