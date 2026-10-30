import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { SellerApplicationStatus } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { regionLabel } from "@/lib/validation/common"

export const metadata: Metadata = { title: "Seller applications", robots: { index: false } }

const TABS: { value: SellerApplicationStatus; label: string }[] = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

export default async function SellerApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: raw } = await searchParams
  const status = TABS.find((t) => t.value === raw)?.value ?? "pending"
  const applications = await prisma.sellerApplication.findMany({
    where: { status },
    orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
    take: 100,
    include: { user: { select: { name: true, email: true } } },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold">Seller applications</h1>
      <nav aria-label="Filter by status" className="mt-4 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/seller-applications?status=${t.value}`}
            aria-current={t.value === status ? "page" : undefined}
            className="rounded-full border px-3 py-1 text-sm aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {applications.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No applications here.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border bg-card">
          {applications.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/seller-applications/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted/60">
                <div className="min-w-0">
                  <p className="font-semibold">{a.storeName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {a.user.name} · {a.user.email} · {a.city}, {regionLabel[a.region]}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="outline">{a.businessType === "registered_business" ? "Business" : "Individual"}</Badge>
                  {a.createdAt.toLocaleDateString("en-GH", { dateStyle: "medium" })}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
