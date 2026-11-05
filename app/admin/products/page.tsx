import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCategoryTree } from "@/lib/catalog/categories"
import { priceRange } from "@/lib/catalog/format"
import { categoryLabel } from "@/lib/catalog/tree"
import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

import { BlockForm, UnblockForm } from "./moderation-forms"

export const metadata: Metadata = { title: "Products" }

const PAGE_SIZE = 30
const VIEWS = [
  { key: "live", label: "Live" },
  { key: "blocked", label: "Blocked" },
  { key: "all", label: "All" },
] as const

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; page?: string; done?: string }> }) {
  const params = await searchParams
  const view = VIEWS.find((v) => v.key === params.view)?.key ?? "live"
  const q = params.q?.trim().slice(0, 100) ?? ""
  const page = Math.max(1, Number(params.page) || 1)
  const where: Prisma.ProductWhereInput = {
    ...(view === "live" ? { status: "active", blockedAt: null } : view === "blocked" ? { blockedAt: { not: null } } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { store: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  }
  const [products, tree] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: { store: { select: { name: true, slug: true } }, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
    getCategoryTree(),
  ])
  const link = (changes: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ view: view === "live" ? undefined : view, q: q || undefined, ...changes })) if (v) sp.set(k, v)
    const s = sp.toString()
    return s ? `/admin/products?${s}` : "/admin/products"
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sellers publish directly. Block a listing to hide it from shoppers; the seller is told why.</p>
      </div>
      {params.done === "blocked" || params.done === "unblocked" ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          {params.done === "blocked" ? "Blocked. The seller has been emailed." : "Unblocked. If the seller had it published, it's live again."}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Product views" className="flex gap-1 text-sm">
          {VIEWS.map((v) => (
            <Link key={v.key} href={link({ view: v.key === "live" ? undefined : v.key })} aria-current={v.key === view ? "page" : undefined} className={cn("rounded-full px-3 py-1", v.key === view ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {v.label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" action="/admin/products">
          {view !== "live" ? <input type="hidden" name="view" value={view} /> : null}
          <input type="search" name="q" defaultValue={q} placeholder="Product or store name" aria-label="Search products" className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm" />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {products.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No products.</p> : null}
      <ul className="grid gap-3">
        {products.slice(0, PAGE_SIZE).map((p) => (
          <li key={p.id} className="rounded-xl border">
            <details>
              <summary className="flex cursor-pointer items-center gap-3 p-3">
                <div className="size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.images[0] ? <img src={p.images[0].url} alt="" className="size-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.store.name} · {categoryLabel(tree, p.categoryId)} · {priceRange(p.minPrice, p.maxPrice)}
                  </p>
                </div>
                {p.blockedAt ? <Badge variant="destructive">Blocked</Badge> : <Badge variant={p.status === "active" ? "secondary" : "outline"}>{p.status === "active" ? "Live" : p.status}</Badge>}
              </summary>
              <div className="grid gap-3 border-t p-3 text-sm">
                <Link href={`/p/${p.slug}`} className="text-primary hover:underline">
                  Open product page
                </Link>
                {p.blockedAt ? (
                  <>
                    <p>
                      <span className="font-medium">Blocked:</span> {p.blockedReason}
                    </p>
                    <UnblockForm productId={p.id} />
                  </>
                ) : (
                  <BlockForm productId={p.id} />
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
      {page > 1 || products.length > PAGE_SIZE ? (
        <nav aria-label="Pages" className="flex justify-between text-sm">
          {page > 1 ? <Link href={link({ page: String(page - 1) })}>← Previous</Link> : <span />}
          {products.length > PAGE_SIZE ? <Link href={link({ page: String(page + 1) })}>Next →</Link> : null}
        </nav>
      ) : null}
    </div>
  )
}
