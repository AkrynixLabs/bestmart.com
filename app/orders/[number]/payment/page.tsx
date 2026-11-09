import { notFound, redirect } from "next/navigation"

import { requireUser } from "@/lib/auth/session"
import { confirmPayment } from "@/lib/payments/service"
import { prisma } from "@/lib/prisma"

// Where the payment page sends the buyer back. We ask the provider for the
// result (the URL itself proves nothing), then show the order.
export default async function PaymentReturnPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const [{ number }, sp] = await Promise.all([params, searchParams])
  const user = await requireUser(`/orders/${number}`)
  const reference = sp.reference ?? sp.trxref ?? ""
  const payment = await prisma.payment.findFirst({ where: { reference, order: { number, userId: user.id } }, select: { reference: true } })
  if (!payment) notFound()
  let outcome: Awaited<ReturnType<typeof confirmPayment>>
  try {
    outcome = await confirmPayment(payment.reference)
  } catch {
    outcome = "pending" // the webhook will finish the job
  }
  redirect(`/orders/${number}?payment=${outcome}`)
}
