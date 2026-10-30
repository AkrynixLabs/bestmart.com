import type { Metadata } from "next"
import Link from "next/link"
import { Clock, ShieldCheck, Store, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { requireUser } from "@/lib/auth/session"
import { formatBps } from "@/lib/money"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

import { ApplicationForm } from "./application-form"

export const metadata: Metadata = { title: "Apply to sell", robots: { index: false } }

export default async function ApplyToSellPage() {
  const user = await requireUser("/sell/apply")
  const [latest, settings] = await Promise.all([
    prisma.sellerApplication.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    getPlatformSettings(),
  ])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sell on BestMart</h1>

      {user.role === "seller" ? (
        <Status icon={Store} tone="success" title="You're a seller">
          <p>Your store is active.</p>
          <Button asChild className="mt-4">
            <Link href="/seller">Open seller dashboard</Link>
          </Button>
        </Status>
      ) : user.role !== "customer" ? (
        <Status icon={ShieldCheck} tone="info" title="Admin account">
          <p>Admin accounts can&apos;t sell. Use a separate customer account to apply.</p>
        </Status>
      ) : latest?.status === "pending" ? (
        <Status icon={Clock} tone="info" title="Your application is under review">
          <p>
            We received your application for <strong>{latest.storeName}</strong> on {latest.createdAt.toLocaleDateString("en-GH", { dateStyle: "long" })}. We usually
            review applications within 2 working days and will email you the outcome.
          </p>
        </Status>
      ) : (
        <>
          {latest?.status === "rejected" ? (
            <Status icon={XCircle} tone="warning" title="Your last application wasn't approved">
              <p>Reason: {latest.rejectionReason}</p>
              <p className="mt-1">You can fix this and apply again below.</p>
            </Status>
          ) : null}
          {!user.emailVerifiedAt ? (
            <p className="mt-6 text-sm text-destructive">Confirm your email address before applying.</p>
          ) : (
            <>
              <p className="mt-3 text-muted-foreground">
                Tell us about your business. We check every seller before they can list products, so buyers can shop with confidence. You&apos;ll need your Ghana Card
                and a Mobile Money or bank account for payouts.
              </p>
              <div className="mt-8 rounded-xl border bg-card p-6">
                <ApplicationForm defaults={{ phone: user.phone ?? "", payoutAccountName: user.name }} commissionPercent={formatBps(settings.commissionBps)} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Status({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Clock
  tone: "info" | "success" | "warning"
  title: string
  children: React.ReactNode
}) {
  const colours = {
    info: "border-brand-blue/30 bg-secondary",
    success: "border-emerald-600/30 bg-emerald-50",
    warning: "border-amber-500/40 bg-amber-50",
  }[tone]
  return (
    <div className={`mt-6 flex gap-3 rounded-xl border p-5 ${colours}`}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  )
}
