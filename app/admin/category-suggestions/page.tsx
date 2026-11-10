import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { getCategoryTree } from "@/lib/catalog/categories"
import { categoryLabel, flatten, MAX_CATEGORY_DEPTH } from "@/lib/catalog/tree"
import { prisma } from "@/lib/prisma"

import { SuggestionReview } from "./review-forms"

export const metadata: Metadata = { title: "Category suggestions" }

export default async function CategorySuggestionsPage({ searchParams }: { searchParams: Promise<{ added?: string; declined?: string }> }) {
  const { added, declined } = await searchParams
  const [tree, pending, recent] = await Promise.all([
    getCategoryTree(),
    prisma.categorySuggestion.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take: 50, include: { store: { select: { name: true, slug: true } } } }),
    prisma.categorySuggestion.findMany({ where: { status: { not: "pending" } }, orderBy: { reviewedAt: "desc" }, take: 20, include: { store: { select: { name: true } } } }),
  ])
  const parents = flatten(tree)
    .filter((c) => c.depth < MAX_CATEGORY_DEPTH)
    .map((c) => [c.id, categoryLabel(tree, c.id)] as [string, string])

  return (
    <div className="grid gap-8">
      <div>
        <Link href="/admin/categories" className="text-sm text-muted-foreground hover:underline">
          ← Categories
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Category suggestions</h1>
        <p className="mt-1 text-sm text-muted-foreground">From sellers who couldn&apos;t find a fit. The seller is emailed either way.</p>
      </div>

      {added && tree.byId.has(added) ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          Added &ldquo;{tree.byId.get(added)!.name}&rdquo; and emailed the seller.{" "}
          <Link href={`/admin/categories/${added}`} className="font-medium underline">
            Add attributes to it
          </Link>
          .
        </p>
      ) : null}
      {declined ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          Suggestion declined and the seller emailed.
        </p>
      ) : null}

      {pending.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No suggestions waiting.</p>
      ) : (
        <ul className="grid gap-4">
          {pending.map((s) => (
            <li key={s.id} className="grid gap-4 rounded-xl border p-4">
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-muted-foreground">
                  From{" "}
                  <Link href={`/s/${s.store.slug}`} className="hover:underline">
                    {s.store.name}
                  </Link>{" "}
                  · {s.parentId && tree.byId.has(s.parentId) ? `under ${categoryLabel(tree, s.parentId)}` : "top level"} · {s.createdAt.toLocaleDateString("en-GH")}
                </p>
                {s.note ? <p className="mt-2 text-sm">&ldquo;{s.note}&rdquo;</p> : null}
              </div>
              <SuggestionReview id={s.id} name={s.name} parentId={s.parentId && tree.byId.has(s.parentId) ? s.parentId : ""} parents={parents} />
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 ? (
        <section>
          <h2 className="font-semibold">Recently reviewed</h2>
          <ul className="mt-3 divide-y rounded-xl border text-sm">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  {s.name} <span className="text-muted-foreground">· {s.store.name}</span>
                </span>
                <Badge variant={s.status === "accepted" ? "secondary" : "outline"}>{s.status === "accepted" ? "Added" : "Declined"}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
