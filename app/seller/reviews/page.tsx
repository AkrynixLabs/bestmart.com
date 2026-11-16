import type { Metadata } from "next"
import Link from "next/link"

import { Stars } from "@/components/reviews/stars"
import { requireSellerStore } from "@/lib/catalog/seller"
import { prisma } from "@/lib/prisma"
import { reviewerName } from "@/lib/reviews/rules"

import { ReplyForm } from "./reply-form"

export const metadata: Metadata = { title: "Reviews", robots: { index: false } }

export default async function SellerReviewsPage() {
  const { store } = await requireSellerStore("/seller/reviews")
  const [reviews, summary] = await Promise.all([
    prisma.review.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } }, product: { select: { title: true, slug: true } } } }),
    prisma.review.aggregate({ where: { storeId: store.id, status: "visible" }, _avg: { rating: true }, _count: { _all: true } }),
  ])
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary._count._all ? `${(summary._avg.rating ?? 0).toFixed(1)} average from ${summary._count._all} review(s). ` : ""}Reviews come only from buyers who received the item. You can reply once, publicly.
        </p>
      </div>
      {reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <ul className="grid gap-4">
          {reviews.map((r) => (
            <li key={r.id} className="grid gap-2 rounded-xl border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Stars rating={r.rating} />
                <span className="font-medium">{reviewerName(r.user.name)}</span>
                <span className="text-muted-foreground">
                  on{" "}
                  <Link href={`/p/${r.product.slug}`} className="hover:underline">
                    {r.product.title}
                  </Link>{" "}
                  · {r.createdAt.toLocaleDateString("en-GH", { dateStyle: "medium" })}
                </span>
                {r.status === "hidden" ? <span className="text-destructive">(hidden by BestMart)</span> : null}
              </div>
              {r.body ? <p className="whitespace-pre-line">{r.body}</p> : null}
              {r.sellerReply ? (
                <p className="rounded-md bg-muted/60 p-3">
                  <span className="font-medium">Your reply: </span>
                  {r.sellerReply}
                </p>
              ) : (
                <ReplyForm reviewId={r.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
