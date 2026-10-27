import type { Metadata } from "next"

import { AuthCard } from "@/components/layout/auth-card"

import { VerifyEmailForm } from "./verify-form"

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } }

// The link lands here and the user presses a button to confirm. Confirming on
// page load would let email security scanners (which open every link) use up
// the token, and GET requests shouldn't change data.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return (
    <AuthCard title="Confirm your email" description="One last step to activate your BestMart account.">
      {token ? <VerifyEmailForm token={token} /> : <p className="text-sm text-destructive">This link is incomplete. Open the link from your email again.</p>}
    </AuthCard>
  )
}
