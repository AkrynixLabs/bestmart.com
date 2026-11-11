import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { requireUser } from "@/lib/auth/session"
import { releaseExpiredReservations } from "@/lib/checkout/orders"
import { describeQuote } from "@/lib/delivery/fee"
import { formatGhs } from "@/lib/money"
import { Timeline } from "@/components/orders/timeline"
import { buyerCanCancel, isShipOverdue, reasonLabel, reportableReasons, statusLabel } from "@/lib/fulfilment/rules"
import { catchUpFulfilment } from "@/lib/fulfilment/service"
import type { Prisma } from "@/lib/generated/prisma/client"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import { regionLabel } from "@/lib/validation/common"

import { orderStatusLabel } from "../status"
import { BuyerCancelForm, CancelOrderForm, ConfirmDeliveryForm, PayButton, ReservationCountdown } from "./order-controls"

export const metadata: Metadata = { title: "Order", robots: { index: false } }

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ placed?: string; cancelled?: string; payment?: string; confirmed?: string; reported?: string; partCancelled?: string }> }) {
  const [{ number }, { placed, cancelled, payment, confirmed, reported, partCancelled }] = await Promise.all([params, searchParams])
  const user = await requireUser(`/orders/${number}`)
  await releaseExpiredReservations()
  await catchUpFulfilment()
  // Ownership is part of the query: someone else's order number is a 404.
  const order = await prisma.order.findFirst({
    where: { number, userId: user.id },
    include: {
      subOrders: {
        orderBy: { createdAt: "asc" },
        include: {
          store: { select: { name: true, slug: true } },
          items: { orderBy: { createdAt: "asc" } },
          events: { orderBy: { createdAt: "asc" } },
          disputes: { orderBy: { createdAt: "desc" } },
        },
      },
      refunds: { where: { status: { not: "failed" } }, orderBy: { createdAt: "asc" } },
    },
  })
  if (!order) notFound()
  const awaiting = order.status === "awaiting_payment"
  const settings = await getPlatformSettings()
  const now = new Date()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/orders" className="text-sm text-muted-foreground hover:underline">
        ← Your orders
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Order {order.number}</h1>
        <Badge variant={awaiting ? "default" : order.status === "paid" ? "secondary" : "outline"}>{orderStatusLabel[order.status]}</Badge>
      </div>

      {placed && awaiting ? (
        <p role="status" className="mt-4 flex gap-2 rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> Order placed. Your items are reserved for you.
        </p>
      ) : null}

      {payment === "paid" && order.status === "paid" ? (
        <p role="status" className="mt-4 flex gap-2 rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> Payment received. The seller has been told to prepare your order, and your money is held until you confirm it arrived.
        </p>
      ) : null}
      {payment === "pending" ? (
        <p role="status" className="mt-4 rounded-md border bg-muted p-3 text-sm">We&apos;re waiting for the payment service to confirm your payment. This page updates when it does; refresh in a minute.</p>
      ) : null}
      {payment === "failed" && awaiting ? (
        <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          The payment didn&apos;t go through. No money was taken. You can try again below.
        </p>
      ) : null}
      {payment === "refunded" ? (
        <p role="status" className="mt-4 rounded-md border bg-muted p-3 text-sm">
          Your payment arrived after the items were no longer available, so we&apos;ve refunded it in full.
        </p>
      ) : null}

      {confirmed ? (
        <p role="status" className="mt-4 flex gap-2 rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> Thanks for confirming! Enjoy your purchase.
        </p>
      ) : null}
      {reported ? (
        <p role="status" className="mt-4 flex gap-2 rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> Problem reported. Your payment for that part is on hold, and we&apos;ll email you when it&apos;s resolved.
        </p>
      ) : null}
      {partCancelled ? (
        <p role="status" className="mt-4 flex gap-2 rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> That part of your order is cancelled and refunded in full.
        </p>
      ) : null}

      {cancelled && order.status === "cancelled" ? (
        <p role="status" className="mt-4 flex gap-2 rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> Order cancelled. The items are back on sale.
        </p>
      ) : null}

      {awaiting ? (
        <section className="mt-4 grid gap-3 rounded-xl border border-brand-orange/40 bg-brand-orange/5 p-4">
          <p className="flex items-center gap-2 text-sm">
            <Clock className="size-4 text-brand-orange-dark" aria-hidden /> Reserved for <ReservationCountdown until={order.reservedUntil.toISOString()} />. After that the items go back on sale.
          </p>
          <PayButton orderNumber={order.number} label={`Pay ${formatGhs(order.grandTotal)}`} />
          <p className="text-xs text-muted-foreground">Mobile Money (MTN, Telecel, AirtelTigo) or card, on Paystack&apos;s secure page.</p>
          <div className="border-t pt-3">
            <CancelOrderForm orderId={order.id} />
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="grid content-start gap-4">
          {order.subOrders.map((sub) => (
            <section key={sub.id} className="rounded-xl border" aria-label={`From ${sub.store.name}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 text-sm">
                <p>
                  From{" "}
                  <Link href={`/s/${sub.store.slug}`} className="font-semibold hover:underline">
                    {sub.store.name}
                  </Link>
                </p>
                {!awaiting && order.status !== "expired" && order.status !== "cancelled" ? <Badge variant="outline">{statusLabel[sub.status]}</Badge> : null}
              </div>
              <SubOrderPanel sub={sub} orderNumber={order.number} returnWindowDays={settings.returnWindowDays} now={now} />
              <ul className="divide-y text-sm">
                {sub.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 px-4 py-2.5">
                    <span>
                      {item.quantity} × {item.title}
                      {item.optionValues.length ? <span className="text-muted-foreground"> · {item.optionValues.join(" / ")}</span> : null}
                    </span>
                    <span className="tabular-nums">{formatGhs(item.lineTotal)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-3 bg-muted/40 px-4 py-2.5">
                  <span>
                    Delivery <span className="block text-xs text-muted-foreground">{describeQuote({ km: sub.deliveryKm, source: sub.distanceSource })}</span>
                  </span>
                  <span className="tabular-nums">{formatGhs(sub.deliveryFee)}</span>
                </li>
              </ul>
            </section>
          ))}
        </div>
        <aside className="grid h-fit gap-4">
          <div className="rounded-xl border p-4 text-sm">
            <h2 className="font-semibold">Total</h2>
            <dl className="mt-2 grid gap-1">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Items</dt>
                <dd className="tabular-nums">{formatGhs(order.itemsTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular-nums">{formatGhs(order.deliveryTotal)}</dd>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatGhs(order.grandTotal)}</dd>
              </div>
              {order.refunds.map((r) => (
                <div key={r.id} className="flex justify-between text-emerald-700">
                  <dt>Refund{r.status === "pending" ? " (processing)" : ""}</dt>
                  <dd className="tabular-nums">−{formatGhs(r.amount)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl border p-4 text-sm">
            <h2 className="font-semibold">Delivery address</h2>
            <p className="mt-2">{order.recipientName}</p>
            <p className="text-muted-foreground">{order.phone}</p>
            <p className="text-muted-foreground">
              {[order.streetAddress, order.area, order.city, regionLabel[order.region]].filter(Boolean).join(", ")}
            </p>
            {order.landmark ? <p className="text-muted-foreground">Near {order.landmark}</p> : null}
            {order.gpsAddress ? <p className="text-muted-foreground">{order.gpsAddress}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

type Sub = Prisma.SubOrderGetPayload<{ include: { events: true; disputes: true } }>

/** Shipping details, the buyer's actions and the history for one seller's part. */
function SubOrderPanel({ sub, orderNumber, returnWindowDays, now }: { sub: Sub; orderNumber: string; returnWindowDays: number; now: Date }) {
  if (sub.status === "awaiting_payment" || sub.status === "expired" || sub.status === "cancelled") return null
  const openDispute = sub.disputes.find((d) => d.status === "open")
  const lastDispute = sub.disputes[0]
  const canReport = !openDispute && reportableReasons(sub, returnWindowDays, now).length > 0
  return (
    <div className="grid gap-3 border-b px-4 py-3 text-sm">
      {sub.shippedAt ? (
        <p>
          <span className="text-muted-foreground">Delivery: </span>
          {sub.deliveryMethod === "courier" ? "Courier" : "Seller's rider"} {sub.carrierName}
          {sub.riderPhone ? (
            <>
              {" · "}
              <a href={`tel:${sub.riderPhone}`} className="underline">
                {sub.riderPhone}
              </a>
            </>
          ) : null}
          {sub.trackingNumber ? ` · tracking ${sub.trackingNumber}` : ""}
        </p>
      ) : null}
      {isShipOverdue(sub, now) ? <p className="font-medium text-brand-orange-dark">The seller hasn&apos;t shipped this within the time allowed.</p> : null}
      {openDispute ? (
        <p className="rounded-md bg-muted p-2">
          Problem reported ({reasonLabel[openDispute.reason].toLowerCase()}): our team is looking into it.
        </p>
      ) : lastDispute?.status === "resolved" ? (
        <p className="rounded-md bg-muted p-2">
          Reported problem resolved: {lastDispute.outcome === "rejected" ? "no refund issued" : "refund issued"}.{lastDispute.resolutionNote ? ` ${lastDispute.resolutionNote}` : ""}
        </p>
      ) : null}
      <div className="flex flex-wrap items-start gap-3">
        {sub.status === "shipped" ? <ConfirmDeliveryForm subOrderId={sub.id} /> : null}
        {buyerCanCancel(sub, now) ? <BuyerCancelForm subOrderId={sub.id} /> : null}
        {canReport ? (
          <Link href={`/orders/${orderNumber}/problem?part=${sub.id}`} className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted">
            Report a problem
          </Link>
        ) : null}
      </div>
      {sub.events.length > 1 ? (
        <details>
          <summary className="cursor-pointer text-muted-foreground">History</summary>
          <div className="mt-3">
            <Timeline events={sub.events} />
          </div>
        </details>
      ) : null}
    </div>
  )
}
