import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, Package, Plus, ShoppingBag, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { requireSellerStore } from "@/lib/catalog/seller"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import { regionLabel } from "@/lib/validation/common"

export const metadata: Metadata = { title: "Seller dashboard", robots: { index: false } }

export default async function SellerDashboardPage() {
  const { store } = await requireSellerStore("/seller")
  const settings = await getPlatformSettings()
  const [byStatus, blocked, lowStock, toShip, late] = await Promise.all([
    prisma.product.groupBy({ by: ["status"], where: { storeId: store.id }, _count: { _all: true } }),
    prisma.product.count({ where: { storeId: store.id, blockedAt: { not: null } } }),
    prisma.productVariant.findMany({
      where: { isActive: true, stock: { lte: settings.lowStockThreshold }, product: { storeId: store.id, status: "active" } },
      orderBy: { stock: "asc" },
      take: 10,
      select: { id: true, sku: true, stock: true, optionValues: true, product: { select: { id: true, title: true } } },
    }),
    prisma.subOrder.count({ where: { storeId: store.id, status: { in: ["paid", "processing"] } } }),
    prisma.subOrder.count({ where: { storeId: store.id, status: { in: ["paid", "processing"] }, shipBy: { lt: new Date() } } }),
  ])
  const count = (status: string) => byStatus.find((s) => s.status === status)?._count._all ?? 0

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{store.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {store.city}, {regionLabel[store.region]} · Payouts to {store.payoutProvider} ending {store.payoutAccountNumber.slice(-4)}
          </p>
        </div>
        <Button asChild>
          <Link href="/seller/products/new">
            <Plus aria-hidden /> Add a product
          </Link>
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Live", count("active")],
          ["Drafts", count("draft")],
          ["Archived", count("archived")],
          ["Blocked by admin", blocked],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="size-4 text-brand-orange-dark" aria-hidden /> Low stock
        </h2>
        <p className="text-sm text-muted-foreground">Live variants with {settings.lowStockThreshold} or fewer left.</p>
        {lowStock.length === 0 ? (
          <p className="mt-3 text-sm">Nothing is running low.</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {lowStock.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/seller/products/${v.product.id}`} className="min-w-0 truncate hover:underline">
                  {v.product.title}
                  {v.optionValues.length ? <span className="text-muted-foreground"> · {v.optionValues.join(" / ")}</span> : null}
                </Link>
                <span className={v.stock === 0 ? "font-semibold text-destructive" : "font-medium text-brand-orange-dark"}>{v.stock === 0 ? "Sold out" : `${v.stock} left`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/seller/orders" className="rounded-xl border p-4 hover:bg-muted/50">
          <ShoppingBag className="size-5 text-brand-blue" aria-hidden />
          <p className="mt-2 font-medium">Orders to ship: {toShip}</p>
          <p className="mt-1 text-sm text-muted-foreground">{late ? `${late} late: ship them or the buyer may cancel.` : "Ship within the deadline on each order."}</p>
        </Link>
        <Link href="/seller/earnings" className="rounded-xl border p-4 hover:bg-muted/50">
          <Wallet className="size-5 text-brand-blue" aria-hidden />
          <p className="mt-2 font-medium">Earnings</p>
          <p className="mt-1 text-sm text-muted-foreground">Held until delivery is confirmed, then paid out weekly.</p>
        </Link>
        <Link href="/seller/products" className="rounded-xl border p-4 hover:bg-muted/50">
          <Package className="size-5 text-brand-blue" aria-hidden />
          <p className="mt-2 font-medium">Products and stock</p>
          <p className="mt-1 text-sm text-muted-foreground">Keep stock up to date so buyers don&apos;t order what you don&apos;t have.</p>
        </Link>
      </section>
    </div>
  )
}
