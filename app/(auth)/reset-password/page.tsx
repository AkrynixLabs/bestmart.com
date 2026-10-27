import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/layout/auth-card"
import { peekToken } from "@/lib/auth/tokens"

import { ResetPasswordForm } from "./reset-form"

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } }

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const valid = token ? Boolean(await peekToken(token, "reset_password")) : false
  return (
    <AuthCard title="Choose a new password">
      {valid && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="grid gap-4 text-sm">
          <p className="text-destructive">This reset link has expired or was already used.</p>
          <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
            Request a new link
          </Link>
        </div>
      )}
    </AuthCard>
  )
}
