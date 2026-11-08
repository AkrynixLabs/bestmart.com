"use server"

import { notFound, redirect } from "next/navigation"

import { FAKE_SECRET, readFake, writeFake } from "@/lib/payments/fake"
import { usingFakePayments } from "@/lib/payments"
import { signBody } from "@/lib/payments/signature"
import { siteOrigin } from "@/lib/request"

// The stand-in's "Pay" / "Decline" buttons. Approving sends a signed
// charge.success webhook to our own endpoint (as Paystack would), then
// returns the buyer to the callback URL.
export async function completeFakePaymentAction(formData: FormData): Promise<void> {
  if (!usingFakePayments()) notFound()
  const reference = String(formData.get("reference") ?? "")
  const outcome = formData.get("outcome") === "approve" ? "success" : "failed"
  const tx = await readFake(reference)
  if (!tx || tx.status !== "pending") notFound()
  tx.status = outcome
  tx.paidAt = outcome === "success" ? new Date().toISOString() : null
  await writeFake(tx)

  if (outcome === "success") {
    const body = JSON.stringify({ event: "charge.success", data: { id: tx.id, reference: tx.reference, amount: tx.amount, currency: "GHS", status: "success" } })
    await fetch(`${await siteOrigin()}/api/webhooks/paystack`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": signBody(body, FAKE_SECRET) },
      body,
      cache: "no-store",
    }).catch(() => {
      // Like a lost webhook: the buyer's return trip still confirms the payment.
    })
  }
  redirect(tx.callbackUrl)
}
