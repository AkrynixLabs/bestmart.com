import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"

import { Breadcrumbs } from "@/components/catalog/breadcrumbs"
import { FiltersPanel } from "@/components/catalog/filters-panel"
import { Pager } from "@/components/catalog/pager"
import { ProductGrid } from "@/components/catalog/product-card"
import { getCategoryTree } from "@/lib/catalog/categories"
import { parseFilters, type SearchParams } from "@/lib/catalog/filters"
import { searchCatalog } from "@/lib/catalog/products"
import { ancestry, childrenOf, effectiveAttributes, isVisible, subtreeIds, type TreeCategory } from "@/lib/catalog/tree"
import { prisma } from "@/lib/prisma"
import { site } from "@/lib/site"

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }

const PAGE_SIZE = 24

/** The visible category for a slug; follows old slugs with a permanent redirect. */
async function resolveCategory(slug: string, searchParams?: SearchParams): Promise<TreeCategory> {
  const tree = await getCategoryTree()
  const category = tree.bySlug.get(slug)
  if (category) {
    if (!isVisible(tree, category.id)) notFound()
    return category
  }
  const old = await prisma.categorySlugRedirect.findUnique({ where: { slug }, select: { categoryId: true } })
  const target = old ? tree.byId.get(old.categoryId) : undefined
  if (!target || !isVisible(tree, target.id)) notFound()
  const query = searchParams ? new URLSearchParams(Object.entries(searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : []))).toString() : ""
  permanentRedirect(`/c/${target.slug}${query ? `?${query}` : ""}`)
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const category = await resolveCategory(slug)
  const filtered = Object.keys(sp).length > 0
  return {
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? category.description ?? `Shop ${category.name} from verified sellers on ${site.name}. Pay with Mobile Money or card; your money is held until your order arrives.`,
    alternates: { canonical: `/c/${category.slug}` },
    // Filtered and paged views are crawlable through links but not indexed separately.
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: category.imageUrl ? { images: [category.imageUrl] } : undefined,
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const category = await resolveCategory(slug, sp)
  const tree = await getCategoryTree()
  const attributes = effectiveAttributes(tree, category.id)
  const filters = parseFilters(sp, attributes.filter((a) => a.isFilterable))
  const result = await searchCatalog({
    categoryIds: subtreeIds(tree, category.id),
    text: filters.text,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
    attributes: filters.attributes,
    sort: filters.sort,
    after: filters.after,
    page: filters.page,
    limit: PAGE_SIZE,
  })
  const children = childrenOf(tree, category.id)
  const pathname = `/c/${category.slug}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={ancestry(tree, category.id).map((c) => ({ name: c.name, href: `/c/${c.slug}` }))} />
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{category.name}</h1>
      {category.description ? <p className="mt-2 max-w-3xl text-muted-foreground">{category.description}</p> : null}

      {children.length > 0 ? (
        <nav aria-label={`${category.name} subcategories`} className="mt-5">
          <ul className="flex flex-wrap gap-2">
            {children.map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.slug}`} className="inline-flex rounded-full border px-3 py-1.5 text-sm hover:bg-muted">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filters">
          <FiltersPanel pathname={pathname} params={sp} attributes={attributes} showRelevance={Boolean(filters.text)} />
        </aside>
        <section aria-label="Products" className="min-w-0">
          <ProductGrid products={result.products} emptyText={filters.isFiltered ? "No products match these filters." : "No products in this category yet. Check back soon."} />
          <Pager pathname={pathname} params={sp} nextCursor={result.nextCursor} nextPage={result.nextPage} isFirst={!filters.after && !filters.page} />
        </section>
      </div>
    </div>
  )
}
