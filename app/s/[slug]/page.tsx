import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BadgeCheck, MapPin } from "lucide-react"

import { FiltersPanel } from "@/components/catalog/filters-panel"
import { Pager } from "@/components/catalog/pager"
import { ProductGrid } from "@/components/catalog/product-card"
import { parseFilters, type SearchParams } from "@/lib/catalog/filters"
import { searchCatalog, visibleCategoryIds } from "@/lib/catalog/products"
import { prisma } from "@/lib/prisma"
import { site } from "@/lib/site"
import { regionLabel } from "@/lib/validation/common"

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }

const PAGE_SIZE = 24

async function loadStore(slug: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, description: true, city: true, region: true, status: true, createdAt: true } })
  if (!store || store.status !== "active") notFound()
  return store
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const store = await loadStore(slug)
  return {
    title: store.name,
    description: store.description ?? `Shop ${store.name}, a verified seller in ${store.city} on ${site.name}.`,
    alternates: { canonical: `/s/${store.slug}` },
    robots: Object.keys(sp).length > 0 ? { index: false, follow: true } : undefined,
  }
}

export default async function StorePage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const store = await loadStore(slug)
  const filters = parseFilters(sp, [])
  const result = await searchCatalog({
    categoryIds: await visibleCategoryIds(),
    storeId: store.id,
    text: filters.text,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
    sort: filters.sort,
    after: filters.after,
    page: filters.page,
    limit: PAGE_SIZE,
  })
  const pathname = `/s/${store.slug}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="rounded-2xl bg-brand-navy p-6 text-white sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{store.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
          <span className="inline-flex items-center gap-1">
            <BadgeCheck className="size-4 text-brand-orange-light" aria-hidden /> Verified seller
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4" aria-hidden /> {store.city}, {regionLabel[store.region]}
          </span>
          <span>On {site.name} since {store.createdAt.toLocaleDateString("en-GH", { month: "long", year: "numeric" })}</span>
        </p>
        {store.description ? <p className="mt-4 max-w-3xl text-white/90">{store.description}</p> : null}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filters">
          <FiltersPanel pathname={pathname} params={sp} attributes={[]} showRelevance={Boolean(filters.text)} />
        </aside>
        <section aria-label="Products" className="min-w-0">
          <ProductGrid products={result.products} emptyText={filters.isFiltered ? "No products match these filters." : "This seller hasn't listed anything yet."} />
          <Pager pathname={pathname} params={sp} nextCursor={result.nextCursor} nextPage={result.nextPage} isFirst={!filters.after && !filters.page} />
        </section>
      </div>
    </div>
  )
}
