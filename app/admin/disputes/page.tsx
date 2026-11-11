import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { reasonLabel } from "@/lib/fulfilment/rules"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Problems" }

export default async function AdminDisputesPage() {
  const [open, recent] = await Promise.all([
    prisma.dispute.findMany({ where: { status: "open" }, orderBy: { createdAt: "asc" }, take: 100, include: { subOrder: { select: { order: { select: { number: true } }, store: { select: { name: true } } } }, openedBy: { select: { name: true } } } }),
    prisma.dispute.findMany({ where: { status: "resolved" }, orderBy: { resolvedAt: "desc" }, take: 20, include: { subOrder: { select: { order: { select: { number: true } }, store: { select: { name: true } } } } } }),
  ])
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reported problems</h1>
        <p className="mt-1 text-sm text-muted-foreground">Oldest first. The seller&apos;s money for the order is frozen until each is resolved.</p>
      </div>
      {open.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No open problems.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {open.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/orders/${d.subOrder.order.number}#dispute-${d.id}`} className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="font-medium">
                    {d.subOrder.order.number} · {reasonLabel[d.reason]}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.openedBy.name} vs {d.subOrder.store.name} · {d.createdAt.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
                    {d.sellerResponse ? " · seller responded" : ""}
                  </p>
                </div>
                <Badge variant="destructive">Open</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {recent.length > 0 ? (
        <section>
          <h2 className="font-semibold">Recently resolved</h2>
          <ul className="mt-3 divide-y rounded-xl border text-sm">
            {recent.map((d) => (
              <li key={d.id} className="flex flex-wrap justify-between gap-2 p-3">
                <Link href={`/admin/orders/${d.subOrder.order.number}`} className="hover:underline">
                  {d.subOrder.order.number} · {d.subOrder.store.name}
                </Link>
                <Badge variant="outline">{d.outcome?.replace("_", " ")}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
