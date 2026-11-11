import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { requireUser } from "@/lib/auth/session"
import { reasonLabel, reportableReasons } from "@/lib/fulfilment/rules"
import { MAX_DISPUTE_PHOTOS } from "@/lib/fulfilment/service"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

import { ProblemForm } from "./problem-form"

export const metadata: Metadata = { title: "Report a problem", robots: { index: false } }

export default async function ReportProblemPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ part?: string }> }) {
  const [{ number }, { part }] = await Promise.all([params, searchParams])
  const user = await requireUser(`/orders/${number}`)
  const sub = await prisma.subOrder.findFirst({
    where: { id: part ?? "", order: { number, userId: user.id } },
    include: { store: { select: { name: true } }, disputes: { where: { status: "open" }, select: { id: true } } },
  })
  if (!sub) notFound()
  const settings = await getPlatformSettings()
  const reasons = reportableReasons(sub, settings.returnWindowDays, new Date())
  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8 sm:px-6">
      <div>
        <Link href={`/orders/${number}`} className="text-sm text-muted-foreground hover:underline">
          ← Order {number}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Report a problem</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          With the part of your order from <strong>{sub.store.name}</strong>. Your payment for it stays on hold while our team looks into it; we&apos;ll email you the outcome.
        </p>
      </div>
      {sub.disputes.length > 0 ? (
        <p className="rounded-xl border p-4 text-sm">You&apos;ve already reported a problem with this; our team is on it.</p>
      ) : reasons.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm">Problems can be reported once it&apos;s on its way, and up to {settings.returnWindowDays} days after delivery.</p>
      ) : (
        <ProblemForm subOrderId={sub.id} reasons={reasons.map((r) => [r, reasonLabel[r]])} maxPhotos={MAX_DISPUTE_PHOTOS} />
      )}
    </div>
  )
}
