import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCategoryTree } from "@/lib/catalog/categories"
import { flatten, isVisible, MAX_CATEGORY_DEPTH } from "@/lib/catalog/tree"
import { formatBps } from "@/lib/money"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Categories" }

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams
  const tree = await getCategoryTree()
  const counts = await prisma.product.groupBy({ by: ["categoryId"], _count: { _all: true } })
  const productCount = new Map(counts.map((c) => [c.categoryId, c._count._all]))
  const rows = flatten(tree)
  const pendingSuggestions = await prisma.categorySuggestion.count({ where: { status: "pending" } })

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Changes show on the storefront immediately. Up to three levels deep. Hide a category to take it (and its products) off the storefront without breaking links.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/category-suggestions">Seller suggestions{pendingSuggestions ? ` (${pendingSuggestions})` : ""}</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/categories/new">
              <Plus aria-hidden /> New category
            </Link>
          </Button>
        </div>
      </div>

      {deleted ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          Category deleted.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Products</th>
              <th className="px-4 py-2 text-right font-medium">Attributes</th>
              <th className="px-4 py-2 text-right font-medium">Commission</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((c) => {
              const visible = isVisible(tree, c.id)
              return (
                <tr key={c.id} className={visible ? "" : "text-muted-foreground"}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${c.depth * 1.5}rem` }}>
                      {c.depth > 0 ? (
                        <span aria-hidden className="text-muted-foreground">
                          └
                        </span>
                      ) : null}
                      <Link href={`/admin/categories/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">/c/{c.slug}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {c.status === "hidden" ? <Badge variant="outline">Hidden</Badge> : visible ? <Badge variant="secondary">Live</Badge> : <Badge variant="outline">Parent hidden</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{productCount.get(c.id) ?? 0}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.attributes.length}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.commissionBps === null ? <span className="text-muted-foreground">inherits</span> : `${formatBps(c.commissionBps)}%`}</td>
                  <td className="px-4 py-2.5 text-right">
                    {c.depth < MAX_CATEGORY_DEPTH ? (
                      <Link href={`/admin/categories/new?parent=${c.id}`} className="text-xs font-medium text-primary hover:underline">
                        Add subcategory
                      </Link>
                    ) : null}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No categories yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
