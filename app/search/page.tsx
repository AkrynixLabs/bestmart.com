import type { Metadata } from "next"
import Link from "next/link"
import { Search, Store } from "lucide-react"

import { FiltersPanel } from "@/components/catalog/filters-panel"
import { Pager } from "@/components/catalog/pager"
import { ProductGrid } from "@/components/catalog/product-card"
import { Button } from "@/components/ui/button"
import { getCategoryTree } from "@/lib/catalog/categories"
import { parseFilters, type SearchParams } from "@/lib/catalog/filters"
import { searchCatalog } from "@/lib/catalog/products"
import { childrenOf, visibleIds } from "@/lib/catalog/tree"
import { prisma } from "@/lib/prisma"

type Props = { searchParams: Promise<SearchParams> }

const PAGE_SIZE = 24

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = (await searchParams).q
  const text = (Array.isArray(q) ? q[0] : q)?.trim()
  return { title: text ? `Results for "${text.slice(0, 60)}"` : "Search", robots: { index: false, follow: true } }
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams
  const filters = parseFilters(sp, [])
  const tree = await getCategoryTree()
  const [result, stores] = await Promise.all([
    filters.text
      ? searchCatalog({
          categoryIds: visibleIds(tree),
          text: filters.text,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          sort: filters.sort,
          after: filters.after,
          page: filters.page,
          limit: PAGE_SIZE,
        })
      : null,
    filters.text && !filters.after && !filters.page
      ? prisma.store.findMany({ where: { status: "active", name: { contains: filters.text, mode: "insensitive" } }, take: 4, select: { id: true, name: true, slug: true, city: true } })
      : [],
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <form action="/search" role="search" className="flex max-w-2xl gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={filters.text ?? ""}
            placeholder="Search products and sellers"
            aria-label="Search products and sellers"
            maxLength={100}
            className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3"
          />
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      {!filters.text ? (
        <section className="mt-8">
          <h1 className="text-xl font-semibold">Browse categories</h1>
          <ul className="mt-4 flex flex-wrap gap-2">
            {childrenOf(tree, null).map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.slug}`} className="inline-flex rounded-full border px-4 py-2 text-sm hover:bg-muted">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Results for &ldquo;{filters.text}&rdquo;</h1>
          {stores.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Matching sellers">
              {stores.map((s) => (
                <li key={s.id}>
                  <Link href={`/s/${s.slug}`} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-muted">
                    <Store className="size-4 text-brand-blue" aria-hidden /> {s.name} <span className="text-muted-foreground">· {s.city}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
            <aside aria-label="Filters">
              <FiltersPanel pathname="/search" params={sp} attributes={[]} showRelevance />
            </aside>
            <section aria-label="Products" className="min-w-0">
              <ProductGrid products={result?.products ?? []} emptyText="No products match your search. Try fewer or different words." />
              {result ? <Pager pathname="/search" params={sp} nextCursor={result.nextCursor} nextPage={result.nextPage} isFirst={!filters.after && !filters.page} /> : null}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
