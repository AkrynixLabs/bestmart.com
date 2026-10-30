import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { prisma } from "@/lib/prisma"
import { regionLabel } from "@/lib/validation/common"

import { ReviewForms } from "./review-forms"

export const metadata: Metadata = { title: "Review application", robots: { index: false } }

export default async function ApplicationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const [{ id }, { done }] = await Promise.all([params, searchParams])
  const app = await prisma.sellerApplication.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true, createdAt: true } }, reviewedBy: { select: { name: true } }, store: { select: { slug: true } } },
  })
  if (!app) notFound()

  const isPdf = app.ghanaCardImageKey.endsWith(".pdf")
  const kycUrl = `/api/admin/kyc/${app.id}`
  const rows: [string, React.ReactNode][] = [
    ["Applicant", `${app.user.name} (${app.user.email})`],
    ["Account created", app.user.createdAt.toLocaleDateString("en-GH", { dateStyle: "medium" })],
    ["Business type", app.businessType === "registered_business" ? `Registered business (${app.businessRegistrationNumber})` : "Individual"],
    ["Phone", app.phone],
    ["Location", `${app.city}, ${regionLabel[app.region]}`],
    ["Plans to sell", app.categoriesNote ?? "Not given"],
    ["Ghana Card number", app.ghanaCardNumber],
    ["Payout", `${app.payoutMethod === "mobile_money" ? "Mobile Money" : "Bank"}: ${app.payoutProvider}, ${app.payoutAccountNumber} (${app.payoutAccountName})`],
    ["Submitted", app.createdAt.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })],
  ]

  return (
    <div className="grid gap-6">
      <Link href="/admin/seller-applications" className="text-sm text-primary hover:underline">
        ← All applications
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{app.storeName}</h1>
        <Badge variant={app.status === "approved" ? "default" : app.status === "rejected" ? "destructive" : "secondary"}>{app.status}</Badge>
      </div>
      {done ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          Application {done}. The applicant has been emailed.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <dl className="grid gap-x-6 gap-y-3 rounded-xl border bg-card p-5 text-sm sm:grid-cols-[170px_1fr]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium break-words">{value}</dd>
            </div>
          ))}
          {app.status !== "pending" ? (
            <div className="contents">
              <dt className="text-muted-foreground">Reviewed</dt>
              <dd className="font-medium">
                {app.reviewedBy?.name ?? "Unknown"} on {app.reviewedAt?.toLocaleDateString("en-GH", { dateStyle: "medium" })}
                {app.rejectionReason ? <span className="block font-normal text-muted-foreground">Reason: {app.rejectionReason}</span> : null}
                {app.store ? <span className="block font-normal text-muted-foreground">Store slug: {app.store.slug}</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="grid content-start gap-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold">Ghana Card</p>
            {isPdf ? (
              <a href={kycUrl} target="_blank" rel="noopener" className="mt-2 inline-block text-sm text-primary underline">
                Open PDF
              </a>
            ) : (
              <a href={kycUrl} target="_blank" rel="noopener">
                {/* Served by an authorised route; next/image can't forward the admin's session. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={kycUrl} alt={`Ghana Card submitted by ${app.user.name}`} className="mt-2 w-full rounded-md border" />
              </a>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Check the name and number match the application and the account name for payouts.</p>
          </div>
          {app.status === "pending" ? <ReviewForms applicationId={app.id} /> : null}
        </div>
      </div>
    </div>
  )
}
