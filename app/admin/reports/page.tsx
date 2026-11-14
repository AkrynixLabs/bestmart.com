import type { Metadata } from "next"
import Link from "next/link"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { requireRole } from "@/lib/auth/session"
import { formatGhs } from "@/lib/money"
import { dailyBreakdown, reportSummary, topCategories, topSellers } from "@/lib/reports/queries"
import { parseRange, PRESETS } from "@/lib/reports/range"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Reports" }

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ preset?: string; from?: string; to?: string }> }) {
  await requireRole(["super_admin"], "/admin/reports")
  const params = await searchParams
  const range = parseRange(params)
  const [s, daily, sellers, categories] = await Promise.all([reportSummary(range), dailyBreakdown(range), topSellers(range), topCategories(range)])
  const exportHref = `/admin/reports/export?from=${range.fromInput}&to=${range.toInput}`
  const cards: [string, number, string?][] = [
    ["Sales", s.sales, `${s.orders} paid order${s.orders === 1 ? "" : "s"}`],
    ["Commission", s.commission],
    ["Net platform revenue", s.netRevenue, "Commission − returned − Paystack fees"],
    ["Refunds", s.refunds],
    ["Paystack fees", s.paystackFees],
    ["Payouts sent", s.payouts],
  ]
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {range.label} ({range.fromInput} to {range.toInput}). Sales count orders paid in the range; refunds count on the day they were processed.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={exportHref}>
            <Download aria-hidden /> Download CSV
          </a>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <nav aria-label="Date range" className="flex flex-wrap gap-1 text-sm">
          {PRESETS.map((p) => (
            <Link key={p.key} href={`/admin/reports?preset=${p.key}`} aria-current={params.preset === p.key ? "page" : undefined} className={cn("rounded-full px-3 py-1", params.preset === p.key ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {p.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/reports" className="flex flex-wrap items-end gap-2 text-sm">
          <label className="grid gap-1">
            From
            <input type="date" name="from" defaultValue={range.fromInput} className="h-9 rounded-md border border-input bg-background px-2" />
          </label>
          <label className="grid gap-1">
            To
            <input type="date" name="to" defaultValue={range.toInput} className="h-9 rounded-md border border-input bg-background px-2" />
          </label>
          <Button type="submit" size="sm" variant="outline">
            Show
          </Button>
        </form>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([label, value, note]) => (
          <div key={label} className="rounded-xl border p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{formatGhs(value)}</dd>
            {note ? <dd className="text-xs text-muted-foreground">{note}</dd> : null}
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="font-semibold">Top sellers</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Seller</th>
                <th className="py-1 text-right font-medium">Orders</th>
                <th className="py-1 text-right font-medium">Item sales</th>
                <th className="py-1 text-right font-medium">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sellers.map((r) => (
                <tr key={r.store}>
                  <td className="py-1.5">{r.store}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.orders}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatGhs(r.sales)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatGhs(r.commission)}</td>
                </tr>
              ))}
              {sellers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-muted-foreground">No sales in this range.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="font-semibold">Categories</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Category</th>
                <th className="py-1 text-right font-medium">Units</th>
                <th className="py-1 text-right font-medium">Item sales</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map((r) => (
                <tr key={r.category}>
                  <td className="py-1.5">{r.category}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.units}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatGhs(r.sales)}</td>
                </tr>
              ))}
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-muted-foreground">No sales in this range.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>

      <section>
        <h2 className="font-semibold">Day by day</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 text-right font-medium">Paid orders</th>
                <th className="px-3 py-2 text-right font-medium">Sales</th>
                <th className="px-3 py-2 text-right font-medium">Commission</th>
                <th className="px-3 py-2 text-right font-medium">Refunds</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {daily.map((d) => (
                <tr key={d.day} className={d.orders === 0 && d.refunds === 0 ? "text-muted-foreground" : ""}>
                  <td className="px-3 py-1.5">{d.day}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.orders}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatGhs(d.sales)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatGhs(d.commission)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatGhs(d.refunds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
