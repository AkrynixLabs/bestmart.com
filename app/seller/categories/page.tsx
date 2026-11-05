import type { Metadata } from "next"

import { Badge } from "@/components/ui/badge"
import { getCategoryTree } from "@/lib/catalog/categories"
import { requireSellerStore } from "@/lib/catalog/seller"
import { categoryLabel, flatten, isVisible, MAX_CATEGORY_DEPTH } from "@/lib/catalog/tree"
import { prisma } from "@/lib/prisma"

import { SuggestCategoryForm } from "./suggest-form"

export const metadata: Metadata = { title: "Suggest a category", robots: { index: false } }

const statusLabel = { pending: "Under review", accepted: "Added", declined: "Not added" } as const

export default async function SuggestCategoryPage() {
  const { store } = await requireSellerStore("/seller/categories")
  const [tree, suggestions] = await Promise.all([
    getCategoryTree(),
    prisma.categorySuggestion.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ])
  const parents = flatten(tree, { includeHidden: false })
    .filter((c) => c.depth < MAX_CATEGORY_DEPTH && isVisible(tree, c.id))
    .map((c) => [c.id, categoryLabel(tree, c.id)] as [string, string])

  return (
    <div className="grid max-w-2xl gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suggest a category</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Can&apos;t find a good fit for your products? Tell us, and our team will add it if it suits BestMart. We&apos;ll email you either way.
        </p>
      </div>
      <SuggestCategoryForm parents={parents} />
      {suggestions.length > 0 ? (
        <section>
          <h2 className="font-semibold">Your suggestions</h2>
          <ul className="mt-3 divide-y rounded-xl border text-sm">
            {suggestions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  {s.response ? <p className="text-muted-foreground">{s.response}</p> : null}
                </div>
                <Badge variant={s.status === "accepted" ? "secondary" : "outline"}>{statusLabel[s.status]}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
