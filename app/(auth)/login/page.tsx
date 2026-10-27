import type { Metadata } from "next"
import Link from "next/link"

import { googleConfigured, signIn } from "@/auth"
import { AuthCard } from "@/components/layout/auth-card"
import { Button } from "@/components/ui/button"

import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

const NOTICES: Record<string, string> = {
  verified: "Your email is confirmed. Sign in to continue.",
  reset: "Your password has been changed. Sign in with your new password.",
}

const ERRORS: Record<string, string> = {
  suspended: "This account has been suspended. Contact support if you think this is a mistake.",
  AccessDenied: "We couldn't sign you in with Google. Use the Google account linked to your BestMart email, or sign in with your password.",
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const notice = params.verified ? NOTICES.verified : params.reset ? NOTICES.reset : undefined
  const error = params.error ? (ERRORS[params.error] ?? "Sign-in failed. Please try again.") : undefined
  const callbackUrl = params.callbackUrl ?? "/account"

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back to BestMart."
      footer={
        <>
          New to BestMart?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm callbackUrl={callbackUrl} notice={notice} initialError={error} />
      {googleConfigured ? (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <form
            action={async () => {
              "use server"
              await signIn("google", { redirectTo: callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/account" })
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>
        </>
      ) : null}
    </AuthCard>
  )
}
