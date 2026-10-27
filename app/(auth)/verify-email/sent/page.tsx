import type { Metadata } from "next"
import Link from "next/link"
import { MailCheck } from "lucide-react"

import { AuthCard } from "@/components/layout/auth-card"

import { ResendForm } from "./resend-form"

export const metadata: Metadata = { title: "Check your email", robots: { index: false } }

export default async function VerifyEmailSentPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams
  return (
    <AuthCard
      title="Check your email"
      description={
        <>
          We&apos;ve sent a confirmation link{email ? <> to <strong className="text-foreground">{email}</strong></> : null}. It expires in 24 hours.
        </>
      }
      footer={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="flex items-start gap-3 rounded-md bg-muted p-4 text-sm">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
        <p>Didn&apos;t get it? Check your spam or promotions folder, or send a new link below.</p>
      </div>
      <div className="mt-4">
        <ResendForm email={email ?? ""} />
      </div>
    </AuthCard>
  )
}
