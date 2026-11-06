import { connection } from "next/server"

import { publicProductCount, SITEMAP_CHUNK, xmlResponse } from "@/lib/catalog/sitemap"
import { appUrl } from "@/lib/site"

// Sitemap index: one file of pages (categories, stores) plus product files.
export async function GET() {
  await connection() // always fresh; never pre-rendered at build time
  const chunks = Math.max(1, Math.ceil((await publicProductCount()) / SITEMAP_CHUNK))
  const files = ["pages.xml", ...Array.from({ length: chunks }, (_, i) => `products-${i}.xml`)]
  const body = files.map((f) => `<sitemap><loc>${appUrl()}/sitemaps/${f}</loc></sitemap>`).join("")
  return xmlResponse(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`)
}
