import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { FlaskConical } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatGhs } from "@/lib/money"
import { usingFakePayments } from "@/lib/payments"
import { readFake } from "@/lib/payments/fake"

import { completeFakePaymentAction } from "./actions"

export const metadata: Metadata = { title: "Test payment", robots: { index: false, follow: false } }

export default async function FakePaystackPage({ params }: { params: Promise<{ reference: string }> }) {
  if (!usingFakePayments()) notFound()
  const { reference } = await params
  const tx = await readFake(reference)
  if (!tx) notFound()
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border p-6 shadow-sm">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-orange-dark">
          <FlaskConical className="size-4" aria-hidden /> Test payment page (no real money)
        </p>
        <h1 className="mt-3 text-2xl font-bold">Pay {formatGhs(tx.amount)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tx.email} · reference {tx.reference}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          This stands in for Paystack&apos;s checkout until Paystack keys are configured. Approving sends BestMart the same signed notification Paystack would.
        </p>
        {tx.status === "pending" ? (
          <form action={completeFakePaymentAction} className="mt-6 grid gap-2">
            <input type="hidden" name="reference" value={tx.reference} />
            <Button type="submit" name="outcome" value="approve" size="lg" variant="accent">
              Approve test Mobile Money payment
            </Button>
            <Button type="submit" name="outcome" value="decline" variant="outline">
              Decline
            </Button>
          </form>
        ) : (
          <p className="mt-6 font-medium">This test payment is already {tx.status === "success" ? "approved" : "declined"}.</p>
        )}
      </div>
    </div>
  )
}
