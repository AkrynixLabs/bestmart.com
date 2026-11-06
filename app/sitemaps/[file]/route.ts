import { connection } from "next/server"

import { pageSitemapEntries, productSitemapChunk, urlset, xmlResponse } from "@/lib/catalog/sitemap"
import { appUrl } from "@/lib/site"

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  await connection()
  const { file } = await params
  if (file === "pages.xml") return xmlResponse(urlset(await pageSitemapEntries()))
  const match = /^products-(\d{1,4})\.xml$/.exec(file)
  if (!match) return new Response("Not found", { status: 404 })
  const rows = await productSitemapChunk(Number(match[1]))
  if (rows.length === 0 && match[1] !== "0") return new Response("Not found", { status: 404 })
  return xmlResponse(urlset(rows.map((r) => ({ loc: `${appUrl()}/p/${r.slug}`, lastmod: r.updatedAt }))))
}
