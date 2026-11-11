import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { requireSellerStore } from "@/lib/catalog/seller"
import { isShipOverdue, statusLabel } from "@/lib/fulfilment/rules"
import { catchUpFulfilment } from "@/lib/fulfilment/service"
import type { Prisma } from "@/lib/generated/prisma/client"
import { formatGhs } from "@/lib/money"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Orders", robots: { index: false } }

const TABS = [
  { key: "to_ship", label: "To ship", statuses: ["paid", "processing"] },
  { key: "shipped", label: "On the way", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
  { key: "closed", label: "Cancelled / refunded", statuses: ["cancelled", "refunded"] },
] as const

export default async function SellerOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { store } = await requireSellerStore("/seller/orders")
  await catchUpFulfilment()
  const { tab: requested } = await searchParams
  const tab = TABS.find((t) => t.key === requested) ?? TABS[0]
  const where: Prisma.SubOrderWhereInput = { storeId: store.id, status: { in: [...tab.statuses] } }
  const [subs, counts] = await Promise.all([
    prisma.subOrder.findMany({
      where,
      orderBy: tab.key === "to_ship" ? { shipBy: "asc" } : { updatedAt: "desc" },
      take: 100,
      include: { order: { select: { number: true, recipientName: true, city: true, area: true } }, items: { select: { quantity: true } }, disputes: { where: { status: "open" }, select: { id: true } } },
    }),
    prisma.subOrder.groupBy({ by: ["status"], where: { storeId: store.id }, _count: { _all: true } }),
  ])
  const count = (statuses: readonly string[]) => counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count._all, 0)
  const now = new Date()
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
      <nav aria-label="Order status" className="flex flex-wrap gap-1 text-sm">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === "to_ship" ? "/seller/orders" : `/seller/orders?tab=${t.key}`} aria-current={t.key === tab.key ? "page" : undefined} className={cn("rounded-full px-3 py-1", t.key === tab.key ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {t.label} ({count(t.statuses)})
          </Link>
        ))}
      </nav>
      {subs.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{tab.key === "to_ship" ? "Nothing to ship right now." : "No orders here."}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {subs.map((s) => {
            const overdue = isShipOverdue(s, now)
            return (
              <li key={s.id}>
                <Link href={`/seller/orders/${s.id}`} className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="font-medium">{s.order.number}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.items.reduce((n, i) => n + i.quantity, 0)} item(s) · {s.order.recipientName}, {s.order.area}, {s.order.city}
                      {tab.key === "to_ship" && s.shipBy ? ` · ship by ${s.shipBy.toLocaleDateString("en-GH", { day: "numeric", month: "short" })}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{formatGhs(s.itemsTotal + s.deliveryFee)}</span>
                    {s.disputes.length ? <Badge variant="destructive">Problem reported</Badge> : null}
                    {overdue ? <Badge variant="destructive">Late</Badge> : null}
                    <Badge variant="outline">{statusLabel[s.status]}</Badge>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
