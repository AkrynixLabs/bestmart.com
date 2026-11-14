import "server-only"

import { getCategoryTree } from "@/lib/catalog/categories"
import { ancestry } from "@/lib/catalog/tree"
import { prisma } from "@/lib/prisma"

import { daysIn, type ReportRange } from "./range"

// Money reports, all in pesewas. "Sales" are orders paid in the range (later
// refunds are reported separately, on the day they were processed).

export type ReportSummary = {
  orders: number
  sales: number // what buyers paid (items + delivery)
  items: number
  delivery: number
  commission: number
  commissionReturned: number
  paystackFees: number
  refunds: number
  payouts: number
  netRevenue: number // commission - commission returned - Paystack fees
}

export type DailyRow = { day: string; orders: number; sales: number; commission: number; refunds: number }

export async function reportSummary(range: ReportRange): Promise<ReportSummary> {
  const paid = { gte: range.from, lt: range.to }
  const [orders, subs, refunds, fees, payouts] = await Promise.all([
    prisma.order.aggregate({ where: { paidAt: paid }, _count: { _all: true }, _sum: { grandTotal: true, itemsTotal: true, deliveryTotal: true } }),
    prisma.subOrder.aggregate({ where: { paidAt: paid }, _sum: { commissionTotal: true } }),
    prisma.refund.aggregate({ where: { status: "processed", processedAt: paid }, _sum: { amount: true, commissionAmount: true } }),
    prisma.payment.aggregate({ where: { status: "succeeded", paidAt: paid }, _sum: { providerFee: true } }),
    prisma.payout.aggregate({ where: { status: "paid", paidAt: paid }, _sum: { amount: true } }),
  ])
  const commission = subs._sum.commissionTotal ?? 0
  const commissionReturned = refunds._sum.commissionAmount ?? 0
  const paystackFees = fees._sum.providerFee ?? 0
  return {
    orders: orders._count._all,
    sales: orders._sum.grandTotal ?? 0,
    items: orders._sum.itemsTotal ?? 0,
    delivery: orders._sum.deliveryTotal ?? 0,
    commission,
    commissionReturned,
    paystackFees,
    refunds: refunds._sum.amount ?? 0,
    payouts: payouts._sum.amount ?? 0,
    netRevenue: commission - commissionReturned - paystackFees,
  }
}

export async function dailyBreakdown(range: ReportRange): Promise<DailyRow[]> {
  const [orders, commission, refunds] = await Promise.all([
    prisma.$queryRaw<{ day: string; orders: bigint; sales: bigint }[]>`
      SELECT to_char("paidAt", 'YYYY-MM-DD') AS day, count(*) AS orders, sum("grandTotal") AS sales
      FROM "orders" WHERE "paidAt" >= ${range.from} AND "paidAt" < ${range.to} GROUP BY 1`,
    prisma.$queryRaw<{ day: string; commission: bigint }[]>`
      SELECT to_char("paidAt", 'YYYY-MM-DD') AS day, sum("commissionTotal") AS commission
      FROM "sub_orders" WHERE "paidAt" >= ${range.from} AND "paidAt" < ${range.to} GROUP BY 1`,
    prisma.$queryRaw<{ day: string; refunds: bigint }[]>`
      SELECT to_char("processedAt", 'YYYY-MM-DD') AS day, sum("amount") AS refunds
      FROM "refunds" WHERE "status" = 'processed' AND "processedAt" >= ${range.from} AND "processedAt" < ${range.to} GROUP BY 1`,
  ])
  const o = new Map(orders.map((r) => [r.day, r]))
  const c = new Map(commission.map((r) => [r.day, Number(r.commission)]))
  const f = new Map(refunds.map((r) => [r.day, Number(r.refunds)]))
  return daysIn(range).map((day) => ({ day, orders: Number(o.get(day)?.orders ?? 0), sales: Number(o.get(day)?.sales ?? 0), commission: c.get(day) ?? 0, refunds: f.get(day) ?? 0 }))
}

export async function topSellers(range: ReportRange, limit = 10) {
  const rows = await prisma.subOrder.groupBy({
    by: ["storeId"],
    where: { paidAt: { gte: range.from, lt: range.to } },
    _sum: { itemsTotal: true, commissionTotal: true },
    _count: { _all: true },
    orderBy: { _sum: { itemsTotal: "desc" } },
    take: limit,
  })
  const stores = await prisma.store.findMany({ where: { id: { in: rows.map((r) => r.storeId) } }, select: { id: true, name: true } })
  const name = new Map(stores.map((s) => [s.id, s.name]))
  return rows.map((r) => ({ store: name.get(r.storeId) ?? "(deleted)", orders: r._count._all, sales: r._sum.itemsTotal ?? 0, commission: r._sum.commissionTotal ?? 0 }))
}

/** Item sales by top-level category (subcategories roll up). */
export async function topCategories(range: ReportRange) {
  const rows = await prisma.$queryRaw<{ categoryId: string | null; sales: bigint; units: bigint }[]>`
    SELECT p."categoryId" AS "categoryId", sum(i."lineTotal") AS sales, sum(i."quantity") AS units
    FROM "order_items" i
    JOIN "sub_orders" s ON s."id" = i."subOrderId"
    LEFT JOIN "products" p ON p."id" = i."productId"
    WHERE s."paidAt" >= ${range.from} AND s."paidAt" < ${range.to}
    GROUP BY 1`
  const tree = await getCategoryTree()
  const totals = new Map<string, { sales: number; units: number }>()
  for (const r of rows) {
    const root = r.categoryId ? ancestry(tree, r.categoryId)[0]?.name : undefined
    const key = root ?? "(removed products)"
    const t = totals.get(key) ?? { sales: 0, units: 0 }
    t.sales += Number(r.sales)
    t.units += Number(r.units)
    totals.set(key, t)
  }
  return [...totals].map(([category, t]) => ({ category, ...t })).sort((a, b) => b.sales - a.sales)
}
