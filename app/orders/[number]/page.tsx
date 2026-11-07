import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { requireUser } from "@/lib/auth/session"
import { releaseExpiredReservations } from "@/lib/checkout/orders"
import { describeQuote } from "@/lib/delivery/fee"
import { formatGhs } from "@/lib/money"
import { prisma } from "@/lib/prisma"
import { regionLabel } from "@/lib/validation/common"

import { orderStatusLabel } from "../status"
import { CancelOrderForm, ReservationCountdown } from "./order-controls"

export const metadata: Metadata = { title: "Order", robots: { index: false } }

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ placed?: string; cancelled?: string }> }) {
  const [{ number }, { placed, cancelled }] = await Promise.all([params, searchParams])
  const user = await requireUser(`/orders/${number}`)
  await releaseExpiredReservations()
  // Ownership is part of the query: someone else's order number is a 404.
  const order = await prisma.order.findFirst({
    where: { number, userId: user.id },
    include: { subOrders: { orderBy: { createdAt: "asc" }, include: { store: { select: { name: true, slug: true } }, items: { orderBy: { createdAt: "asc" } } } } },
  })
  if (!order) notFound()
  const awaiting = order.status === "awaiting_payment"

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
          <p className="text-sm text-muted-foreground">Online payment (Mobile Money and card, through Paystack) opens in the next update. For now you can review or cancel this order.</p>
          <CancelOrderForm orderId={order.id} />
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="grid content-start gap-4">
          {order.subOrders.map((sub) => (
            <section key={sub.id} className="rounded-xl border" aria-label={`From ${sub.store.name}`}>
              <p className="border-b px-4 py-2.5 text-sm">
                From{" "}
                <Link href={`/s/${sub.store.slug}`} className="font-semibold hover:underline">
                  {sub.store.name}
                </Link>
              </p>
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
