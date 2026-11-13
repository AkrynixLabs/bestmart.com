import type { Metadata } from "next"

import { Badge } from "@/components/ui/badge"
import { requireRole } from "@/lib/auth/session"
import { formatGhs } from "@/lib/money"
import { paymentProvider } from "@/lib/payments"
import { maskAccount, WEEKDAYS } from "@/lib/payouts/rules"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

import { ApproveForm, BankCodeForm, CancelBatchForm, PrepareForm } from "./forms"

export const metadata: Metadata = { title: "Payouts" }

const DONE: Record<string, string> = {
  prepared: "Batch prepared. Check it, then approve.",
  approved: "Approved. Transfers have been sent; each payout updates when Paystack confirms it.",
  cancelled: "Draft cancelled. Nothing was sent.",
}

const statusVariant = (s: string) => (s === "paid" || s === "completed" ? "secondary" : s === "failed" ? "destructive" : "outline")

export default async function AdminPayoutsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  await requireRole(["super_admin"], "/admin/payouts")
  const { done } = await searchParams
  const [settings, open, history] = await Promise.all([
    getPlatformSettings(),
    prisma.payoutBatch.findFirst({
      where: { status: { in: ["draft", "sending"] } },
      include: { payouts: { orderBy: { amount: "desc" }, include: { store: { select: { id: true, name: true, payoutMethod: true, payoutProvider: true, payoutAccountNumber: true, payoutAccountName: true } } } } },
    }),
    prisma.payoutBatch.findMany({
      where: { status: { in: ["completed", "cancelled"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { payouts: { include: { store: { select: { name: true } } } }, approvedBy: { select: { name: true } } },
    }),
  ])
  const needsBank = open?.payouts.some((p) => p.issue?.includes("not recognised"))
  const banks = needsBank ? await paymentProvider().listBanks().catch(() => []) : []

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          A batch is drafted every {WEEKDAYS[settings.payoutWeekday]} for sellers with at least {formatGhs(settings.payoutMinimum)} available. Amounts are rechecked when you approve. BestMart pays the transfer fees.
        </p>
      </div>
      {done && DONE[done] ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          {DONE[done]}
        </p>
      ) : null}

      {open ? (
        <section className="grid gap-4 rounded-xl border p-4" aria-label="Current batch">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {open.status === "draft" ? "Draft batch" : "Sending"} · {open.createdAt.toLocaleDateString("en-GH", { dateStyle: "medium" })}
            </h2>
            <span className="font-semibold tabular-nums">{formatGhs(open.total)}</span>
          </div>
          <ul className="divide-y rounded-lg border text-sm">
            {open.payouts.map((p) => (
              <li key={p.id} className="grid gap-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{p.store.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {p.store.payoutMethod === "mobile_money" ? `${p.store.payoutProvider} MoMo` : p.store.payoutProvider} {maskAccount(p.store.payoutAccountNumber)} · {p.store.payoutAccountName}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatGhs(p.amount)}</span>
                    <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                  </span>
                </div>
                {p.issue ? <p className="text-destructive">{p.issue}</p> : null}
                {p.failureReason && p.status !== "pending" ? <p className="text-muted-foreground">{p.failureReason}</p> : null}
                {p.issue?.includes("not recognised") && banks.length > 0 ? <BankCodeForm storeId={p.store.id} banks={banks.map((b) => [b.code, b.name])} /> : null}
              </li>
            ))}
          </ul>
          {open.status === "draft" ? (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <ApproveForm batchId={open.id} total={formatGhs(open.total)} />
              <CancelBatchForm batchId={open.id} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for Paystack to confirm the remaining transfers.</p>
          )}
        </section>
      ) : (
        <section className="grid gap-3 rounded-xl border border-dashed p-4">
          <p className="text-sm text-muted-foreground">No batch is open.</p>
          <PrepareForm />
        </section>
      )}

      {history.length > 0 ? (
        <section>
          <h2 className="font-semibold">Past batches</h2>
          <ul className="mt-3 grid gap-2">
            {history.map((b) => (
              <li key={b.id} className="rounded-xl border">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <span>
                      {b.createdAt.toLocaleDateString("en-GH", { dateStyle: "medium" })} · {b.payouts.filter((p) => p.status === "paid").length} paid
                      {b.payouts.some((p) => p.status === "failed") ? `, ${b.payouts.filter((p) => p.status === "failed").length} failed` : ""}
                      {b.approvedBy ? ` · approved by ${b.approvedBy.name}` : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{formatGhs(b.total)}</span>
                      <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                    </span>
                  </summary>
                  <ul className="divide-y border-t text-sm">
                    {b.payouts.map((p) => (
                      <li key={p.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                        <span>
                          {p.store.name}
                          {p.failureReason ? <span className="block text-xs text-muted-foreground">{p.failureReason}</span> : null}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{formatGhs(p.amount)}</span>
                          <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
