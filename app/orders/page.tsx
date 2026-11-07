import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { requireUser } from "@/lib/auth/session"
import { releaseExpiredReservations } from "@/lib/checkout/orders"
import { formatGhs } from "@/lib/money"
import { prisma } from "@/lib/prisma"

import { orderStatusLabel } from "./status"

export const metadata: Metadata = { title: "Your orders", robots: { index: false } }

export default async function OrdersPage() {
  const user = await requireUser("/orders")
  await releaseExpiredReservations()
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { subOrders: { select: { _count: { select: { items: true } } } } },
  })
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Your orders</h1>
      {orders.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          No orders yet.{" "}
          <Link href="/" className="font-medium text-primary hover:underline">
            Start shopping
          </Link>
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/50">
                <div>
                  <p className="font-semibold">{o.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {o.createdAt.toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })} · {o.subOrders.reduce((s, x) => s + x._count.items, 0)} item(s)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{formatGhs(o.grandTotal)}</span>
                  <Badge variant={o.status === "awaiting_payment" ? "default" : o.status === "paid" ? "secondary" : "outline"}>{orderStatusLabel[o.status]}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
