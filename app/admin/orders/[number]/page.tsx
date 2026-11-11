import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Timeline } from "@/components/orders/timeline"
import { Badge } from "@/components/ui/badge"
import { reasonLabel, statusLabel } from "@/lib/fulfilment/rules"
import { describeQuote } from "@/lib/delivery/fee"
import { formatBps, formatGhs } from "@/lib/money"
import { prisma } from "@/lib/prisma"
import { regionLabel } from "@/lib/validation/common"

import { orderStatusLabel } from "../../../orders/status"
import { ResolveDisputeForm } from "../../disputes/resolve-form"
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

const DONE: Record<string, string> = {
  refunded: "Refund sent. The buyer has been emailed.",
  refund_pending: "Refund requested; it will show as processed once the payment service confirms.",
  resolved: "Resolved. The buyer and seller have been emailed.",
}

export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ done?: string }> }) {
  const [{ number }, { done }] = await Promise.all([params, searchParams])
  const order = await prisma.order.findUnique({
    where: { number },
    include: {
      user: { select: { name: true, email: true } },
      payments: { orderBy: { createdAt: "asc" } },
      refunds: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } } } },
      subOrders: {
        orderBy: { createdAt: "asc" },
        include: {
          store: { select: { name: true, slug: true } },
          items: { orderBy: { createdAt: "asc" } },
          ledgerEntries: { orderBy: { createdAt: "asc" } },
          events: { orderBy: { createdAt: "asc" } },
          disputes: { orderBy: { createdAt: "desc" }, include: { attachments: true, resolvedBy: { select: { name: true } } } },
        },
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

      {done && DONE[done] ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          {DONE[done]}
        </p>
      ) : null}

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
              <Badge variant="outline">{statusLabel[sub.status]}</Badge>
            </div>
            {sub.shippedAt ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Shipped {sub.shippedAt.toLocaleDateString("en-GH")}: </span>
                {sub.deliveryMethod === "courier" ? "courier" : "own rider"} {sub.carrierName}
                {sub.riderPhone ? ` · ${sub.riderPhone}` : ""}
                {sub.trackingNumber ? ` · tracking ${sub.trackingNumber}` : ""}
                {sub.deliveredAt ? ` · delivered ${sub.deliveredAt.toLocaleDateString("en-GH")} (${sub.confirmedBy === "system" ? "auto" : sub.confirmedBy})` : ""}
              </p>
            ) : sub.shipBy && (sub.status === "paid" || sub.status === "processing") ? (
              <p className="text-sm text-muted-foreground">Ship by {sub.shipBy.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}</p>
            ) : null}
            {sub.disputes.map((d) => (
              <div key={d.id} id={`dispute-${d.id}`} className={d.status === "open" ? "grid gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" : "grid gap-2 rounded-lg bg-muted/50 p-3 text-sm"}>
                <p className="font-semibold">
                  {d.status === "open" ? "Open problem" : `Resolved: ${d.outcome?.replace("_", " ")}`} · {reasonLabel[d.reason]}
                </p>
                <p>
                  <span className="text-muted-foreground">Buyer: </span>&ldquo;{d.description}&rdquo;
                </p>
                {d.sellerResponse ? (
                  <p>
                    <span className="text-muted-foreground">Seller: </span>&ldquo;{d.sellerResponse}&rdquo;
                  </p>
                ) : null}
                {d.attachments.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {d.attachments.map((a, i) => (
                      <li key={a.id}>
                        <a href={`/api/admin/dispute-photos/${a.id}`} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/admin/dispute-photos/${a.id}`} alt={`Evidence photo ${i + 1}`} className="size-24 rounded-md border object-cover" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {d.status === "resolved" && d.resolutionNote ? <p className="text-muted-foreground">Note: {d.resolutionNote} ({d.resolvedBy?.name})</p> : null}
                {d.status === "open" ? <ResolveDisputeForm disputeId={d.id} maxLabel={formatGhs(sub.itemsTotal + sub.deliveryFee - sub.refundedTotal)} /> : null}
              </div>
            ))}
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
            {sub.events.length > 0 ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">History</summary>
                <div className="mt-3">
                  <Timeline events={sub.events} />
                </div>
              </details>
            ) : null}
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
