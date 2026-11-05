import type { Metadata } from "next"
import Link from "next/link"

import { getCategoryTree } from "@/lib/catalog/categories"
import { requireSellerStore } from "@/lib/catalog/seller"
import { listableCategories } from "@/lib/catalog/tree"

import { NewProductForm } from "./new-product-form"

export const metadata: Metadata = { title: "Add a product", robots: { index: false } }

export default async function NewProductPage() {
  await requireSellerStore("/seller/products/new")
  const categories = listableCategories(await getCategoryTree())
  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <Link href="/seller/products" className="text-sm text-muted-foreground hover:underline">
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Add a product</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start with a name and category. You&apos;ll add photos, details, prices and stock next. It stays a draft until you publish.</p>
      </div>
      <NewProductForm categories={categories.map((c) => [c.id, c.label])} />
      <p className="text-sm text-muted-foreground">
        Can&apos;t find the right category?{" "}
        <Link href="/seller/categories" className="font-medium text-primary hover:underline">
          Suggest one
        </Link>
        .
      </p>
    </div>
  )
}
