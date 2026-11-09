import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Prisma } from "@/lib/generated/prisma/client"
import { formatGhs } from "@/lib/money"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

import { orderStatusLabel } from "../../orders/status"

export const metadata: Metadata = { title: "Orders" }

const PAGE_SIZE = 50
const VIEWS = [
  { key: "paid", label: "Paid" },
  { key: "awaiting_payment", label: "Awaiting payment" },
  { key: "refunded", label: "Refunded" },
  { key: "all", label: "All" },
] as const

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; page?: string }> }) {
  const params = await searchParams
  const view = VIEWS.find((v) => v.key === params.view)?.key ?? "paid"
  const q = params.q?.trim().slice(0, 100) ?? ""
  const page = Math.max(1, Number(params.page) || 1)
  const where: Prisma.OrderWhereInput = {
    ...(view === "all" ? {} : { status: view }),
    ...(q ? { OR: [{ number: { contains: q.toUpperCase() } }, { user: { email: { contains: q.toLowerCase() } } }, { recipientName: { contains: q, mode: "insensitive" } }] } : {}),
  }
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: { user: { select: { email: true } }, subOrders: { select: { store: { select: { name: true } } } } },
  })
  const link = (changes: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ view: view === "paid" ? undefined : view, q: q || undefined, ...changes })) if (v) sp.set(k, v)
    const s = sp.toString()
    return s ? `/admin/orders?${s}` : "/admin/orders"
  }
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Order views" className="flex flex-wrap gap-1 text-sm">
          {VIEWS.map((v) => (
            <Link key={v.key} href={link({ view: v.key === "paid" ? undefined : v.key })} aria-current={v.key === view ? "page" : undefined} className={cn("rounded-full px-3 py-1", v.key === view ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {v.label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" action="/admin/orders">
          {view !== "paid" ? <input type="hidden" name="view" value={view} /> : null}
          <input type="search" name="q" defaultValue={q} placeholder="Order number, email or name" aria-label="Search orders" className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm" />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
      </div>
      {orders.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No orders.</p> : null}
      <ul className="divide-y rounded-xl border">
        {orders.slice(0, PAGE_SIZE).map((o) => (
          <li key={o.id}>
            <Link href={`/admin/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-muted/50">
              <div className="min-w-0">
                <p className="font-medium">{o.number}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {o.user.email} · {o.subOrders.map((s) => s.store.name).join(", ")} · {o.createdAt.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">{formatGhs(o.grandTotal)}</span>
                {o.refundedTotal > 0 && o.status !== "refunded" ? <Badge variant="outline">Part refunded</Badge> : null}
                <Badge variant={o.status === "paid" ? "secondary" : "outline"}>{orderStatusLabel[o.status]}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {page > 1 || orders.length > PAGE_SIZE ? (
        <nav aria-label="Pages" className="flex justify-between text-sm">
          {page > 1 ? <Link href={link({ page: String(page - 1) })}>← Previous</Link> : <span />}
          {orders.length > PAGE_SIZE ? <Link href={link({ page: String(page + 1) })}>Next →</Link> : null}
        </nav>
      ) : null}
    </div>
  )
}
