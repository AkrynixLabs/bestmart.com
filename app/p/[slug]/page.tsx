import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BadgeCheck, Eye, ShieldCheck } from "lucide-react"

import { Breadcrumbs } from "@/components/catalog/breadcrumbs"
import { JsonLd } from "@/components/catalog/json-ld"
import { getCurrentUser, isAdmin } from "@/lib/auth/session"
import { getCategoryTree } from "@/lib/catalog/categories"
import { formatAttributeValue, readOptions } from "@/lib/catalog/product-rules"
import { getProductBySlug, isProductPublic, type ProductWithDetails } from "@/lib/catalog/products"
import { ancestry, effectiveAttributes } from "@/lib/catalog/tree"
import { getPlatformSettings } from "@/lib/platform-settings"
import { appUrl, site } from "@/lib/site"
import { regionLabel } from "@/lib/validation/common"

import { Gallery } from "./gallery"
import { VariantPicker } from "./variant-picker"

type Props = { params: Promise<{ slug: string }> }

/**
 * The product if shoppers can see it; otherwise only its seller and admins
 * get a preview. Everyone else gets a 404 (no hint that it exists).
 */
async function loadProduct(slug: string): Promise<{ product: ProductWithDetails; preview: boolean }> {
  const product = await getProductBySlug(slug)
  if (!product) notFound()
  if (await isProductPublic(product)) return { product, preview: false }
  const user = await getCurrentUser()
  if (user && (user.id === product.store.userId || isAdmin(user.role))) return { product, preview: true }
  notFound()
}

const plain = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { product, preview } = await loadProduct(slug)
  const description = plain(product.description.replace(/\s+/g, " ").trim() || `${product.title} from ${product.store.name} on ${site.name}.`, 160)
  return {
    title: product.title,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    robots: preview ? { index: false, follow: false } : undefined,
    openGraph: { title: product.title, description, images: product.images.slice(0, 1).map((i) => i.url) },
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const { product, preview } = await loadProduct(slug)
  const [tree, settings] = await Promise.all([getCategoryTree(), getPlatformSettings()])
  const variants = product.variants.filter((v) => v.isActive)
  const options = readOptions(product.options)
  const attributes = effectiveAttributes(tree, product.categoryId)
  const valueFor = new Map(product.attributeValues.map((v) => [v.attributeId, v]))
  const specs = attributes.flatMap((a) => {
    const v = valueFor.get(a.id)
    const text = v ? formatAttributeValue(a, v) : ""
    return text ? [{ name: a.name, value: text }] : []
  })
  const inStock = variants.some((v) => v.stock > 0)
  const url = `${appUrl()}/p/${product.slug}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {preview ? (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-md border border-brand-orange/40 bg-brand-orange/10 p-3 text-sm">
          <Eye className="size-4 shrink-0" aria-hidden />
          Preview: shoppers can&apos;t see this product {product.blockedAt ? "(blocked by an admin)" : product.status === "active" ? "(its category or store is hidden)" : `(${product.status})`}.
        </p>
      ) : null}
      <Breadcrumbs items={[...ancestry(tree, product.categoryId).map((c) => ({ name: c.name, href: `/c/${c.slug}` })), { name: product.title, href: `/p/${product.slug}` }]} />

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt }))} title={product.title} />

        <div className="grid content-start gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{product.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sold by{" "}
              <Link href={`/s/${product.store.slug}`} className="font-medium text-foreground hover:underline">
                {product.store.name}
              </Link>{" "}
              · {product.store.city}, {regionLabel[product.store.region]}
            </p>
          </div>

          {variants.length > 0 ? (
            <VariantPicker
              options={options}
              variants={variants.map((v) => ({ id: v.id, optionValues: v.optionValues, price: v.price, compareAtPrice: v.compareAtPrice, stock: v.stock }))}
              lowStockThreshold={settings.lowStockThreshold}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Not available right now.</p>
          )}

          <ul className="grid gap-3 rounded-xl bg-muted/60 p-4 text-sm">
            <li className="flex gap-3">
              <ShieldCheck className="size-5 shrink-0 text-brand-blue" aria-hidden />
              <span>
                <strong>Buyer protection.</strong> Your payment is held by {site.name} and only released to the seller after you confirm delivery.
              </span>
            </li>
            <li className="flex gap-3">
              <BadgeCheck className="size-5 shrink-0 text-brand-blue" aria-hidden />
              <span>
                <strong>Verified seller.</strong> {product.store.name} passed ID and payout checks before listing.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="description">
          <h2 id="description" className="text-lg font-semibold">
            Description
          </h2>
          <div className="mt-3 whitespace-pre-line leading-relaxed text-foreground/90">{product.description}</div>
        </section>
        {specs.length > 0 ? (
          <section aria-labelledby="specs">
            <h2 id="specs" className="text-lg font-semibold">
              Specifications
            </h2>
            <dl className="mt-3 divide-y rounded-xl border text-sm">
              {specs.map((s) => (
                <div key={s.name} className="grid grid-cols-[40%_1fr] gap-3 px-4 py-2.5">
                  <dt className="text-muted-foreground">{s.name}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>

      {!preview && variants.length > 0 ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.title,
            description: plain(product.description, 5000),
            image: product.images.map((i) => (i.url.startsWith("http") ? i.url : `${appUrl()}${i.url}`)),
            sku: variants[0]?.sku,
            brand: specs.find((s) => s.name.toLowerCase() === "brand") ? { "@type": "Brand", name: specs.find((s) => s.name.toLowerCase() === "brand")!.value } : undefined,
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "GHS",
              lowPrice: (product.minPrice / 100).toFixed(2),
              highPrice: (product.maxPrice / 100).toFixed(2),
              offerCount: variants.length,
              availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url,
              seller: { "@type": "Organization", name: product.store.name },
            },
          }}
        />
      ) : null}
    </div>
  )
}
