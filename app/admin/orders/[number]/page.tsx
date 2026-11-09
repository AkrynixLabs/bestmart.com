import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { describeQuote } from "@/lib/delivery/fee"
import { formatBps, formatGhs } from "@/lib/money"
import { prisma } from "@/lib/prisma"
import { regionLabel } from "@/lib/validation/common"

import { orderStatusLabel } from "../../../orders/status"
import { RefundForm } from "./refund-form"

export const metadata: Metadata = { title: "Order" }

const kindLabel: Record<string, string> = {
  sale: "Sale",
  commission: "Commission",
  delivery: "Delivery fee",
  refund: "Refund (items)",
  commission_reversal: "Commission returned",
  delivery_refund: "Refund (delivery)",
  payout: "Payout",
  adjustment: "Adjustment",
}

export default async function AdminOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params
  const order = await prisma.order.findUnique({
    where: { number },
    include: {
      user: { select: { name: true, email: true } },
      payments: { orderBy: { createdAt: "asc" } },
      refunds: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } } } },
      subOrders: {
        orderBy: { createdAt: "asc" },
        include: { store: { select: { name: true, slug: true } }, items: { orderBy: { createdAt: "asc" } }, ledgerEntries: { orderBy: { createdAt: "asc" } } },
      },
    },
  })
  if (!order) notFound()
  const refundable = order.status === "paid" || order.status === "refunded"

  return (
    <div className="grid gap-8">
      <div>
        <Link href="/admin/orders" className="text-sm text-muted-foreground hover:underline">
          ← Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Order {order.number}</h1>
          <Badge variant={order.status === "paid" ? "secondary" : "outline"}>{orderStatusLabel[order.status]}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {order.user.name} · {order.user.email} · placed {order.createdAt.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
          {order.paidAt ? ` · paid ${order.paidAt.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}` : ""}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Items", order.itemsTotal],
          ["Delivery", order.deliveryTotal],
          ["Total paid", order.status === "awaiting_payment" || order.status === "expired" || order.status === "cancelled" ? 0 : order.grandTotal],
          ["Refunded", order.refundedTotal],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{formatGhs(value as number)}</dd>
          </div>
        ))}
      </dl>

      {order.subOrders.map((sub) => {
        const left = sub.itemsTotal + sub.deliveryFee - sub.refundedTotal
        const balance = sub.ledgerEntries.reduce((s, e) => s + e.amount, 0)
        return (
          <section key={sub.id} className="grid gap-4 rounded-xl border p-4" aria-label={`Part from ${sub.store.name}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                <Link href={`/s/${sub.store.slug}`} className="hover:underline">
                  {sub.store.name}
                </Link>
              </h2>
              <Badge variant="outline">{sub.status.replace("_", " ")}</Badge>
            </div>
            <ul className="divide-y text-sm">
              {sub.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    {item.quantity} × {item.title}
                    {item.optionValues.length ? <span className="text-muted-foreground"> · {item.optionValues.join(" / ")}</span> : null}
                    <span className="text-xs text-muted-foreground"> · {item.sku} · commission {formatBps(item.commissionBps)}%</span>
                  </span>
                  <span className="tabular-nums">{formatGhs(item.lineTotal)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 py-1.5">
                <span>
                  Delivery <span className="text-xs text-muted-foreground">({describeQuote({ km: sub.deliveryKm, source: sub.distanceSource })})</span>
                </span>
                <span className="tabular-nums">{formatGhs(sub.deliveryFee)}</span>
              </li>
            </ul>

            {sub.ledgerEntries.length > 0 ? (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">Seller ledger</p>
                <ul className="mt-1 grid gap-0.5">
                  {sub.ledgerEntries.map((e) => (
                    <li key={e.id} className="flex justify-between gap-3">
                      <span>
                        {kindLabel[e.kind]} <span className="text-xs text-muted-foreground">({e.bucket})</span>
                      </span>
                      <span className="tabular-nums">{formatGhs(e.amount)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3 border-t pt-1 font-semibold">
                    <span>Seller is owed</span>
                    <span className="tabular-nums">{formatGhs(balance)}</span>
                  </li>
                </ul>
              </div>
            ) : null}

            {refundable && left > 0 ? <RefundForm subOrderId={sub.id} maxLabel={formatGhs(left)} /> : null}
          </section>
        )
      })}

      <section className="grid gap-2">
        <h2 className="font-semibold">Payments</h2>
        {order.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment attempts.</p>
        ) : (
          <ul className="divide-y rounded-xl border text-sm">
            {order.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {p.reference} · {p.status}
                  {p.channel ? ` · ${p.channel.replace("_", " ")}` : ""}
                  {p.failureReason ? <span className="block text-xs text-muted-foreground">{p.failureReason}</span> : null}
                </span>
                <span className="tabular-nums">
                  {formatGhs(p.amount)}
                  {p.providerFee !== null ? <span className="text-xs text-muted-foreground"> (fee {formatGhs(p.providerFee)})</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {order.refunds.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="font-semibold">Refunds</h2>
          <ul className="divide-y rounded-xl border text-sm">
            {order.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {r.status} · {r.reason}
                  <span className="block text-xs text-muted-foreground">
                    {r.automatic ? "Automatic" : `By ${r.createdBy?.name ?? "an admin"}`} · items {formatGhs(r.itemsAmount)}, delivery {formatGhs(r.deliveryAmount)}, commission returned {formatGhs(r.commissionAmount)}
                  </span>
                </span>
                <span className="tabular-nums">{formatGhs(r.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border p-4 text-sm">
        <h2 className="font-semibold">Delivery address</h2>
        <p className="mt-1">
          {order.recipientName} · {order.phone}
        </p>
        <p className="text-muted-foreground">{[order.streetAddress, order.area, order.city, regionLabel[order.region]].filter(Boolean).join(", ")}</p>
        {order.landmark ? <p className="text-muted-foreground">Near {order.landmark}</p> : null}
      </section>
    </div>
  )
}
