import { createHash } from "node:crypto"

/** SHA-256 of a raw token; only this is stored in the database. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}
