import type { Metadata } from "next"
import Link from "next/link"
import { ImageOff, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCategoryTree } from "@/lib/catalog/categories"
import { priceRange } from "@/lib/catalog/format"
import { requireSellerStore } from "@/lib/catalog/seller"
import { categoryLabel } from "@/lib/catalog/tree"
import type { Prisma } from "@/lib/generated/prisma/client"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Products", robots: { index: false } }

const PAGE_SIZE = 50
const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Live" },
  { key: "draft", label: "Drafts" },
  { key: "blocked", label: "Blocked" },
  { key: "archived", label: "Archived" },
] as const

export default async function SellerProductsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; page?: string }> }) {
  const { store } = await requireSellerStore("/seller/products")
  const params = await searchParams
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "all"
  const q = params.q?.trim().slice(0, 100) ?? ""
  const page = Math.max(1, Number(params.page) || 1)

  const where: Prisma.ProductWhereInput = {
    storeId: store.id,
    ...(tab === "all" ? { status: { not: "archived" } } : tab === "blocked" ? { blockedAt: { not: null } } : { status: tab }),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  }
  const [products, settings, tree] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        variants: { where: { isActive: true }, select: { stock: true } },
      },
    }),
    getPlatformSettings(),
    getCategoryTree(),
  ])
  const hasMore = products.length > PAGE_SIZE
  const link = (changes: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    const merged = { tab: tab === "all" ? undefined : tab, q: q || undefined, ...changes }
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    const s = sp.toString()
    return s ? `/seller/products?${s}` : "/seller/products"
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <Button asChild>
          <Link href="/seller/products/new">
            <Plus aria-hidden /> Add a product
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter products" className="flex flex-wrap gap-1 text-sm">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={link({ tab: t.key === "all" ? undefined : t.key, page: undefined })}
              aria-current={t.key === tab ? "page" : undefined}
              className={cn("rounded-full px-3 py-1", t.key === tab ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" action="/seller/products">
          {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search your products"
            aria-label="Search your products"
            className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">{q || tab !== "all" ? "No products match." : "You haven't added any products yet."}</p>
          {!q && tab === "all" ? (
            <Button asChild className="mt-4">
              <Link href="/seller/products/new">Add your first product</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {products.slice(0, PAGE_SIZE).map((p) => {
            const image = p.images[0]
            const lowest = p.variants.length ? Math.min(...p.variants.map((v) => v.stock)) : null
            const low = p.status === "active" && lowest !== null && lowest <= settings.lowStockThreshold
            return (
              <li key={p.id}>
                <Link href={`/seller/products/${p.id}`} className="flex items-center gap-4 p-3 hover:bg-muted/50">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.url} alt="" className="size-full object-cover" />
                    ) : (
                      <ImageOff className="size-5 text-muted-foreground" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{categoryLabel(tree, p.categoryId)}</p>
                  </div>
                  <div className="hidden text-right text-sm sm:block">
                    <p className="tabular-nums">{priceRange(p.minPrice, p.maxPrice)}</p>
                    <p className={cn("text-xs tabular-nums", low ? "font-semibold text-brand-orange-dark" : "text-muted-foreground")}>
                      {p.totalStock} in stock{low ? " · low" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {p.blockedAt ? <Badge variant="destructive">Blocked</Badge> : null}
                    <Badge variant={p.status === "active" ? "secondary" : "outline"}>{p.status === "active" ? "Live" : p.status === "draft" ? "Draft" : "Archived"}</Badge>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {page > 1 || hasMore ? (
        <nav aria-label="Pages" className="flex justify-between text-sm">
          {page > 1 ? <Link href={link({ page: String(page - 1) })}>← Previous</Link> : <span />}
          {hasMore ? <Link href={link({ page: String(page + 1) })}>Next →</Link> : null}
        </nav>
      ) : null}
    </div>
  )
}
