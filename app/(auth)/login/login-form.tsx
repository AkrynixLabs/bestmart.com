"use client"

import { useActionState } from "react"
import Link from "next/link"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { loginAction, resendVerificationAction } from "../actions"

export function LoginForm({ callbackUrl, notice, initialError }: { callbackUrl: string; notice?: string; initialError?: string }) {
  const [state, action] = useActionState(loginAction, initialFormState)
  const [resendState, resend] = useActionState(resendVerificationAction, initialFormState)
  const shown = state.error || state.fieldErrors ? state : { ...state, success: notice, error: initialError }

  return (
    <div className="grid gap-4">
      <FormMessage state={shown} />
      <form action={action} className="grid gap-4" noValidate>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <TextField name="email" label="Email" type="email" autoComplete="email" required state={state} />
        <TextField name="password" label="Password" type="password" autoComplete="current-password" required state={state} />
        <div className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">
            Forgot your password?
          </Link>
        </div>
        <SubmitButton className="w-full" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      {state.values?.needsVerification ? (
        <form action={resend} className="grid gap-2 rounded-md bg-muted p-3">
          <input type="hidden" name="email" value={state.values.email ?? ""} />
          <FormMessage state={resendState} />
          <SubmitButton variant="secondary" size="sm" pendingText="Sending…">
            Send a new confirmation link
          </SubmitButton>
        </form>
      ) : null}
    </div>
  )
}
