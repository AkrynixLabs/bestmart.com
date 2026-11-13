import type { Metadata } from "next"

import { requireSellerStore } from "@/lib/catalog/seller"
import { catchUpFulfilment } from "@/lib/fulfilment/service"
import { formatGhs } from "@/lib/money"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Earnings", robots: { index: false } }

const kindLabel: Record<string, string> = {
  sale: "Sale",
  commission: "BestMart commission",
  delivery: "Delivery fee",
  refund: "Refund to buyer",
  commission_reversal: "Commission returned",
  delivery_refund: "Delivery fee refunded",
  payout: "Paid to you",
  adjustment: "Adjustment",
}

export default async function SellerEarningsPage() {
  const { store } = await requireSellerStore("/seller/earnings")
  await catchUpFulfilment()
  const [buckets, entries, settings, payouts] = await Promise.all([
    prisma.ledgerEntry.groupBy({ by: ["bucket"], where: { storeId: store.id }, _sum: { amount: true } }),
    prisma.ledgerEntry.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { subOrder: { select: { order: { select: { number: true } } } } },
    }),
    getPlatformSettings(),
    prisma.payout.findMany({ where: { storeId: store.id, status: { in: ["processing", "paid", "failed"] } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ])
  const sum = (bucket: string) => buckets.find((b) => b.bucket === bucket)?._sum.amount ?? 0
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Earnings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Money from paid orders is held by BestMart (buyer protection) as <strong>pending</strong>. It becomes <strong>available</strong> {settings.payoutHoldDays} days after the buyer confirms delivery, then goes to your {store.payoutProvider} account in the weekly payout.
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Pending</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">{formatGhs(sum("pending"))}</dd>
        </div>
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Available for payout</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">{formatGhs(sum("available"))}</dd>
        </div>
      </dl>
      {payouts.length > 0 ? (
        <section>
          <h2 className="font-semibold">Payouts</h2>
          <ul className="mt-3 divide-y rounded-xl border text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  {p.status === "paid" ? "Sent" : p.status === "failed" ? "Failed (returned to your balance)" : "Sending"} to {store.payoutProvider}
                  <span className="block text-xs text-muted-foreground">
                    {(p.paidAt ?? p.createdAt).toLocaleDateString("en-GH", { dateStyle: "medium" })} · {p.reference}
                  </span>
                </span>
                <span className="tabular-nums">{formatGhs(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-semibold">Recent activity</h2>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing yet. Earnings appear here when a buyer pays.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-xl border text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  {kindLabel[e.kind]}
                  {e.subOrder ? <span className="text-muted-foreground"> · order {e.subOrder.order.number}</span> : null}
                  <span className="block text-xs text-muted-foreground">
                    {e.createdAt.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })} · {e.bucket}
                  </span>
                </span>
                <span className={e.amount < 0 ? "tabular-nums text-destructive" : "tabular-nums"}>{formatGhs(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
