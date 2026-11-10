import { randomBytes } from "node:crypto"

/** "Ama's Fashion & Co." -> "amas-fashion-co" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "") || "store"
}

/** "Kente Stole, Gold" -> "kente-stole-gold-k3x9q2". The random suffix keeps slugs unique without a lookup. */
export function productSlug(title: string): string {
  // slugify() falls back to "store" for titles with no letters or digits.
  const base = /[a-z0-9]/i.test(title.normalize("NFKD")) ? slugify(title) : "product"
  return `${base}-${randomBytes(4).readUInt32BE(0).toString(36).padStart(6, "0").slice(-6)}`
}
