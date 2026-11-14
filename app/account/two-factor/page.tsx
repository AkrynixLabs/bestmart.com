import type { Metadata } from "next"
import { ShieldCheck } from "lucide-react"

import { isAdmin, requireUser } from "@/lib/auth/session"
import { groupSecret, otpauthUri } from "@/lib/auth/totp"
import { beginSetup, justEnabledHere, pendingSecret, remainingRecoveryCodes } from "@/lib/auth/two-factor"

import { SetupForm, VerifyForm } from "./forms"

export const metadata: Metadata = { title: "Two-factor sign-in", robots: { index: false } }

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser("/account/two-factor")
  const next = (await searchParams).next ?? "/admin"
  if (!isAdmin(user.role)) {
    return (
      <section className="rounded-xl border bg-card p-6">
        <h1 className="text-xl font-bold">Two-factor sign-in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Two-factor sign-in is required for BestMart admin accounts. Your account doesn&apos;t need it.</p>
      </section>
    )
  }

  // Right after setup the page re-renders (setting the verified cookie
  // refreshes it). Keep the setup form in the same place for a few minutes
  // so it keeps showing the recovery codes it just received.
  const justEnabled = await justEnabledHere(user)
  if (!user.totpEnabledAt || justEnabled) {
    // Reuse a pending secret so a refresh doesn't invalidate what's already in the app.
    const secret = justEnabled ? null : ((await pendingSecret(user.id)) ?? (await beginSetup(user.id)))
    return (
      <section className="grid gap-5 rounded-xl border bg-card p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="size-5 text-brand-blue" aria-hidden /> Set up two-factor sign-in
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Admin accounts can move money, so they need a second step: a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, …).</p>
        </div>
        {secret ? (
          <ol className="grid list-decimal gap-3 pl-5 text-sm">
            <li>
              In your authenticator app, add an account and enter this setup key:
              <code className="mt-1 block w-fit rounded bg-muted px-2 py-1 font-mono text-base tracking-wider" aria-label="Setup key">
                {groupSecret(secret)}
              </code>
              <span className="mt-1 block text-muted-foreground">
                On this phone? <a href={otpauthUri(secret, user.email)} className="text-primary underline">Open it in your authenticator app</a>.
              </span>
            </li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
        ) : null}
        <SetupForm next={next} />
      </section>
    )
  }

  const left = await remainingRecoveryCodes(user.id)
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck className="size-5 text-brand-blue" aria-hidden /> Confirm it&apos;s you
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the code from your authenticator app to open the admin area. You&apos;ll stay verified on this device for 12 hours.</p>
      </div>
      <VerifyForm next={next} />
      <p className="text-xs text-muted-foreground">
        {left} recovery code{left === 1 ? "" : "s"} left. Lost your phone and codes? Ask the Super Admin to reset your two-factor sign-in.
      </p>
    </section>
  )
}
