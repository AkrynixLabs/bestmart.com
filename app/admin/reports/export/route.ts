import { audit } from "@/lib/audit"
import { routeAdmin } from "@/lib/auth/session"
import { clientIp } from "@/lib/request"
import { cedis, toCsv } from "@/lib/reports/csv"
import { dailyBreakdown, reportSummary, topSellers } from "@/lib/reports/queries"
import { parseRange } from "@/lib/reports/range"

// CSV of the report for a date range (Super Admin only, two-factor verified).
export async function GET(request: Request) {
  const admin = await routeAdmin(["super_admin"])
  if (!admin) return new Response("Not found", { status: 404 })
  const url = new URL(request.url)
  const range = parseRange({ preset: url.searchParams.get("preset") ?? undefined, from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined })
  const [s, daily, sellers] = await Promise.all([reportSummary(range), dailyBreakdown(range), topSellers(range, 50)])
  const csv = toCsv([
    ["BestMart report", range.fromInput, "to", range.toInput, "(GHS)"],
    [],
    ["Paid orders", s.orders],
    ["Sales (items + delivery)", cedis(s.sales)],
    ["Items", cedis(s.items)],
    ["Delivery fees (to sellers)", cedis(s.delivery)],
    ["Commission", cedis(s.commission)],
    ["Commission returned on refunds", cedis(s.commissionReturned)],
    ["Paystack fees", cedis(s.paystackFees)],
    ["Net platform revenue", cedis(s.netRevenue)],
    ["Refunds processed", cedis(s.refunds)],
    ["Payouts sent", cedis(s.payouts)],
    [],
    ["Day", "Paid orders", "Sales", "Commission", "Refunds"],
    ...daily.map((d) => [d.day, d.orders, cedis(d.sales), cedis(d.commission), cedis(d.refunds)]),
    [],
    ["Seller", "Orders", "Item sales", "Commission"],
    ...sellers.map((r) => [r.store, r.orders, cedis(r.sales), cedis(r.commission)]),
  ])
  await audit({ actorId: admin.id, action: "report.exported", entityType: "report", entityId: `${range.fromInput}_${range.toInput}`, ip: await clientIp() })
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bestmart-report-${range.fromInput}-to-${range.toInput}.csv"`,
      "Cache-Control": "private, no-store",
    },
  })
}
