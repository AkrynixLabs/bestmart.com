import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { getCategoryTree } from "@/lib/catalog/categories"
import { publishProblems, readOptions } from "@/lib/catalog/product-rules"
import { requireSellerStore } from "@/lib/catalog/seller"
import { categoryLabel, childrenOf, effectiveAttributes, isVisible, listableCategories } from "@/lib/catalog/tree"
import { toCediInput } from "@/lib/money"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import { MAX_PRODUCT_IMAGES } from "@/lib/validation/catalog"

import { ChangeCategoryForm } from "./change-category-form"
import { DetailsForm } from "./details-form"
import { ImageManager } from "./image-manager"
import { StatusPanel } from "./status-panel"
import { VariantsEditor } from "./variants-editor"

export const metadata: Metadata = { title: "Edit product", robots: { index: false } }

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, { created }] = await Promise.all([params, searchParams])
  const { store } = await requireSellerStore(`/seller/products/${id}`)
  const product = await prisma.product.findFirst({
    where: { id, storeId: store.id },
    include: {
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      variants: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      attributeValues: true,
    },
  })
  if (!product) notFound()

  const [tree, settings] = await Promise.all([getCategoryTree(), getPlatformSettings()])
  const attributes = effectiveAttributes(tree, product.categoryId)
  const listable = tree.byId.has(product.categoryId) && isVisible(tree, product.categoryId) && childrenOf(tree, product.categoryId).length === 0
  const problems = publishProblems({
    title: product.title,
    description: product.description,
    categoryListable: listable,
    imageCount: product.images.length,
    variants: product.variants,
    requiredAttributes: attributes.filter((a) => a.isRequired),
    filledAttributeIds: product.attributeValues.map((v) => v.attributeId),
  })
  const valuesByAttribute = Object.fromEntries(
    product.attributeValues.map((v) => [v.attributeId, { textValues: v.textValues, numberValue: v.numberValue, booleanValue: v.booleanValue }]),
  )

  return (
    <div className="grid gap-10">
      <div>
        <Link href="/seller/products" className="text-sm text-muted-foreground hover:underline">
          ← Products
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{product.title}</h1>
          <Badge variant={product.status === "active" ? "secondary" : "outline"}>{product.status === "active" ? "Live" : product.status === "draft" ? "Draft" : "Archived"}</Badge>
          <Link href={`/p/${product.slug}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            {product.status === "active" && !product.blockedAt ? "View on store" : "Preview"} <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{categoryLabel(tree, product.categoryId)}</p>
        {created ? (
          <p role="status" className="mt-4 rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
            Draft created. Add photos, a description, prices and stock, then publish.
          </p>
        ) : null}
      </div>

      <StatusPanel
        productId={product.id}
        status={product.status}
        blockedReason={product.blockedAt ? (product.blockedReason ?? "No reason given.") : null}
        problems={problems}
      />

      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-semibold">Photos</h2>
          <p className="text-sm text-muted-foreground">
            Up to {MAX_PRODUCT_IMAGES}. The first one is the main photo. Large photos are shrunk on your device before upload.
          </p>
        </div>
        <ImageManager productId={product.id} title={product.title} images={product.images.map((i) => ({ id: i.id, url: i.url }))} max={MAX_PRODUCT_IMAGES} />
      </section>

      <section className="grid max-w-3xl gap-3">
        <h2 className="text-lg font-semibold">Details</h2>
        <DetailsForm
          productId={product.id}
          title={product.title}
          description={product.description}
          attributes={attributes.map((a) => ({ id: a.id, key: a.key, name: a.name, type: a.type, unit: a.unit, options: a.options, isRequired: a.isRequired }))}
          values={valuesByAttribute}
        />
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-semibold">Prices, options and stock</h2>
          <p className="text-sm text-muted-foreground">
            Add options like Size or Colour if the product comes in versions; each combination gets its own SKU, price and stock. You&apos;ll see a low-stock warning at{" "}
            {settings.lowStockThreshold} or fewer.
          </p>
        </div>
        <VariantsEditor
          // Changes after a save, so new rows pick up their database ids.
          version={product.variants.map((v) => `${v.id}:${v.updatedAt.getTime()}`).join("|") || "new"}
          productId={product.id}
          title={product.title}
          lowStockThreshold={settings.lowStockThreshold}
          initialOptions={readOptions(product.options)}
          initialVariants={product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            optionValues: v.optionValues,
            price: toCediInput(v.price),
            compareAtPrice: v.compareAtPrice ? toCediInput(v.compareAtPrice) : "",
            stock: String(v.stock),
            isActive: v.isActive,
          }))}
        />
      </section>

      <section className="grid max-w-3xl gap-3">
        <h2 className="text-lg font-semibold">Category</h2>
        <ChangeCategoryForm productId={product.id} categoryId={product.categoryId} categories={listableCategories(tree).map((c) => [c.id, c.label])} />
      </section>
    </div>
  )
}
