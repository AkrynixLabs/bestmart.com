import type { Metadata } from "next"
import Link from "next/link"

import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Admin", robots: { index: false } }

export default async function AdminOverviewPage() {
  const [pending, sellers, customers, disputes, late] = await Promise.all([
    prisma.sellerApplication.count({ where: { status: "pending" } }),
    prisma.store.count(),
    prisma.user.count({ where: { role: "customer" } }),
    prisma.dispute.count({ where: { status: "open" } }),
    prisma.subOrder.count({ where: { status: { in: ["paid", "processing"] }, shipBy: { lt: new Date() } } }),
  ])
  const stats = [
    { label: "Problems to resolve", value: disputes, href: "/admin/disputes" },
    { label: "Late shipments", value: late, href: "/admin/orders" },
    { label: "Applications waiting", value: pending, href: "/admin/seller-applications" },
    { label: "Approved sellers", value: sellers },
    { label: "Customers", value: customers },
  ]
  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <li key={s.label} className="rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{s.value.toLocaleString("en-GH")}</p>
            {s.href ? (
              <Link href={s.href} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                Review
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
