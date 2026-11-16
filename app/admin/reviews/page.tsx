import type { Metadata } from "next"
import Link from "next/link"

import { Stars } from "@/components/reviews/stars"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

import { VisibilityForm } from "./forms"

export const metadata: Metadata = { title: "Reviews" }

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<{ view?: string; rating?: string; done?: string }> }) {
  const params = await searchParams
  const view = params.view === "hidden" ? "hidden" : "visible"
  const low = params.rating === "low"
  const reviews = await prisma.review.findMany({
    where: { status: view, ...(low ? { rating: { lte: 2 } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true, email: true } }, product: { select: { title: true, slug: true } }, store: { select: { name: true } } },
  })
  const tab = (href: string, label: string, active: boolean) => (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("rounded-full px-3 py-1", active ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
      {label}
    </Link>
  )
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
      {params.done === "hidden" || params.done === "restored" ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          {params.done === "hidden" ? "Review hidden. The product's rating no longer counts it." : "Review visible again."}
        </p>
      ) : null}
      <nav aria-label="Review views" className="flex flex-wrap gap-1 text-sm">
        {tab("/admin/reviews", "Visible", view === "visible" && !low)}
        {tab("/admin/reviews?rating=low", "1–2 stars", low)}
        {tab("/admin/reviews?view=hidden", "Hidden", view === "hidden")}
      </nav>
      <ul className="grid gap-3">
        {reviews.map((r) => (
          <li key={r.id} className="grid gap-2 rounded-xl border p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Stars rating={r.rating} />
              <Link href={`/p/${r.product.slug}`} className="font-medium hover:underline">
                {r.product.title}
              </Link>
              <span className="text-muted-foreground">
                · {r.store.name} · by {r.user.name} ({r.user.email}) · {r.createdAt.toLocaleDateString("en-GH", { dateStyle: "medium" })}
              </span>
            </div>
            {r.body ? <p className="whitespace-pre-line">{r.body}</p> : null}
            {r.hiddenReason ? <p className="text-destructive">Hidden: {r.hiddenReason}</p> : null}
            <VisibilityForm reviewId={r.id} hidden={r.status === "hidden"} />
          </li>
        ))}
        {reviews.length === 0 ? <li className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No reviews here.</li> : null}
      </ul>
    </div>
  )
}
