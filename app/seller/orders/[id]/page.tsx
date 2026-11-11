import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, Phone } from "lucide-react"

import { Timeline } from "@/components/orders/timeline"
import { Badge } from "@/components/ui/badge"
import { requireSellerStore } from "@/lib/catalog/seller"
import { allowed, isShipOverdue, reasonLabel, releaseAt, statusLabel } from "@/lib/fulfilment/rules"
import { catchUpFulfilment } from "@/lib/fulfilment/service"
import { formatGhs } from "@/lib/money"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import { regionLabel } from "@/lib/validation/common"

import { AcceptForm, DisputeResponseForm, SellerCancelForm, ShipForm } from "./forms"

export const metadata: Metadata = { title: "Order", robots: { index: false } }

const DONE: Record<string, string> = {
  accepted: "Accepted. The buyer can see you're preparing it.",
  shipped: "Marked as shipped. The buyer has been told who's bringing it.",
  cancelled: "Cancelled. The buyer is being refunded in full and the items are back in stock.",
}

export default async function SellerOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const [{ id }, { done }] = await Promise.all([params, searchParams])
  const { store } = await requireSellerStore(`/seller/orders/${id}`)
  await catchUpFulfilment()
  // Scoped to this store: another seller's order id is a 404.
  const sub = await prisma.subOrder.findFirst({
    where: { id, storeId: store.id, status: { notIn: ["awaiting_payment", "expired"] } },
    include: {
      order: true,
      items: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      disputes: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!sub) notFound()
  const settings = await getPlatformSettings()
  const now = new Date()
  const openDispute = sub.disputes.find((d) => d.status === "open")
  const youGet = sub.itemsTotal - sub.commissionTotal + sub.deliveryFee
  const o = sub.order

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/seller/orders" className="text-sm text-muted-foreground hover:underline">
          ← Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Order {o.number}</h1>
          <Badge variant="outline">{statusLabel[sub.status]}</Badge>
          {isShipOverdue(sub, now) ? <Badge variant="destructive">Late: the buyer may cancel</Badge> : null}
        </div>
        {sub.shipBy && (sub.status === "paid" || sub.status === "processing") ? (
          <p className="mt-1 text-sm text-muted-foreground">Ship by {sub.shipBy.toLocaleString("en-GH", { dateStyle: "full", timeStyle: "short" })}.</p>
        ) : null}
        {sub.status === "delivered" && sub.deliveredAt ? (
          <p className="mt-1 text-sm text-muted-foreground">Your earnings become available on {releaseAt(sub.deliveredAt, settings.payoutHoldDays).toLocaleDateString("en-GH", { dateStyle: "full" })} if no problem is reported.</p>
        ) : null}
      </div>

      {done && DONE[done] ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          {DONE[done]}
        </p>
      ) : null}

      {openDispute ? (
        <section className="grid gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-4" aria-hidden /> Problem reported: {reasonLabel[openDispute.reason]}
          </p>
          <p className="text-sm">&ldquo;{openDispute.description}&rdquo;</p>
          <p className="text-sm text-muted-foreground">Your earnings for this order are on hold until our team resolves it.</p>
          <DisputeResponseForm subOrderId={sub.id} disputeId={openDispute.id} current={openDispute.sellerResponse} />
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-6">
          {allowed(sub.status, "ship", "seller") ? (
            <section className="grid gap-4 rounded-xl border p-4" aria-label="Ship this order">
              <h2 className="font-semibold">Ship it</h2>
              {allowed(sub.status, "accept", "seller") ? <AcceptForm subOrderId={sub.id} /> : null}
              <ShipForm subOrderId={sub.id} />
              <details className="border-t pt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground">Can&apos;t fulfil this order?</summary>
                <div className="mt-3">
                  <SellerCancelForm subOrderId={sub.id} />
                </div>
              </details>
            </section>
          ) : null}

          {sub.shippedAt ? (
            <section className="rounded-xl border p-4 text-sm">
              <h2 className="font-semibold">Shipping</h2>
              <p className="mt-1">
                {sub.deliveryMethod === "courier" ? "Courier" : "Own rider"}: {sub.carrierName}
                {sub.riderPhone ? ` · ${sub.riderPhone}` : ""}
                {sub.trackingNumber ? ` · tracking ${sub.trackingNumber}` : ""}
              </p>
            </section>
          ) : null}

          <section className="rounded-xl border">
            <ul className="divide-y text-sm">
              {sub.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 px-4 py-2.5">
                  <span>
                    {item.quantity} × {item.title}
                    {item.optionValues.length ? <span className="text-muted-foreground"> · {item.optionValues.join(" / ")}</span> : null}
                    <span className="block text-xs text-muted-foreground">SKU {item.sku}</span>
                  </span>
                  <span className="tabular-nums">{formatGhs(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1 border-t px-4 py-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd className="tabular-nums">{formatGhs(sub.itemsTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">BestMart commission</dt><dd className="tabular-nums">−{formatGhs(sub.commissionTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Delivery fee (yours)</dt><dd className="tabular-nums">{formatGhs(sub.deliveryFee)}</dd></div>
              {sub.refundedTotal > 0 ? <div className="flex justify-between text-destructive"><dt>Refunded to the buyer</dt><dd className="tabular-nums">−{formatGhs(sub.refundedTotal)}</dd></div> : null}
              <div className="flex justify-between border-t pt-1 font-semibold"><dt>You receive</dt><dd className="tabular-nums">{formatGhs(youGet)}{sub.refundedTotal > 0 ? " before refunds" : ""}</dd></div>
            </dl>
          </section>

          <section>
            <h2 className="mb-3 font-semibold">History</h2>
            <Timeline events={sub.events} />
          </section>
        </div>

        <aside className="grid h-fit gap-4">
          <div className="rounded-xl border p-4 text-sm">
            <h2 className="font-semibold">Deliver to</h2>
            <p className="mt-2 font-medium">{o.recipientName}</p>
            <p className="flex items-center gap-1">
              <Phone className="size-3.5" aria-hidden /> <a href={`tel:${o.phone}`} className="hover:underline">{o.phone}</a>
            </p>
            <p className="mt-1 text-muted-foreground">{[o.streetAddress, o.area, o.city, regionLabel[o.region]].filter(Boolean).join(", ")}</p>
            {o.landmark ? <p className="text-muted-foreground">Near {o.landmark}</p> : null}
            {o.gpsAddress ? <p className="text-muted-foreground">GhanaPost GPS: {o.gpsAddress}</p> : null}
            {o.latitude !== null && o.longitude !== null ? (
              <a className="mt-2 inline-block text-primary hover:underline" href={`https://www.openstreetmap.org/?mlat=${o.latitude}&mlon=${o.longitude}#map=17/${o.latitude}/${o.longitude}`} target="_blank" rel="noreferrer">
                Open the map pin
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
