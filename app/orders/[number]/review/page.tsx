import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { requireUser } from "@/lib/auth/session"
import { reviewableItems } from "@/lib/reviews/service"

import { ReviewForm } from "./review-form"

export const metadata: Metadata = { title: "Write a review", robots: { index: false } }

export default async function WriteReviewPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ item?: string }> }) {
  const [{ number }, { item }] = await Promise.all([params, searchParams])
  const user = await requireUser(`/orders/${number}`)
  const line = (await reviewableItems(user.id, number)).find((i) => i.id === item)
  if (!line) notFound()
  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8 sm:px-6">
      <div>
        <Link href={`/orders/${number}`} className="text-sm text-muted-foreground hover:underline">
          ← Order {number}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Review: {line.title}</h1>
        {line.optionValues.length ? <p className="text-sm text-muted-foreground">{line.optionValues.join(" / ")}</p> : null}
      </div>
      <ReviewForm orderItemId={line.id} orderNumber={number} />
    </div>
  )
}
