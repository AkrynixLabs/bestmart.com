"use client"

import { useActionState } from "react"
import Link from "next/link"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { Button } from "@/components/ui/button"
import { initialFormState } from "@/lib/actions/state"

import { confirmSetupAction, verifyAction, type SetupState } from "./actions"

export function SetupForm({ next }: { next: string }) {
  const [state, action] = useActionState<SetupState, FormData>(confirmSetupAction, initialFormState)
  if (state.recoveryCodes) {
    return (
      <div className="grid gap-4">
        <FormMessage state={state} />
        <div className="rounded-xl border border-brand-orange/40 bg-brand-orange/5 p-4">
          <p className="font-semibold">Save these recovery codes now</p>
          <p className="mt-1 text-sm text-muted-foreground">Each works once if you lose your phone. You won&apos;t see them again.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Recovery codes">
            {state.recoveryCodes.map((c) => (
              <li key={c} className="rounded bg-background px-2 py-1">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Button asChild>
            <Link href={state.next ?? "/admin"}>I&apos;ve saved them. Continue</Link>
          </Button>
        </div>
      </div>
    )
  }
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <TextField name="code" label="6-digit code from the app" inputMode="numeric" autoComplete="one-time-code" maxLength={6} state={state} />
      <div>
        <SubmitButton pendingText="Checking…">Turn on two-factor sign-in</SubmitButton>
      </div>
    </form>
  )
}

export function VerifyForm({ next }: { next: string }) {
  const [state, action] = useActionState(verifyAction, initialFormState)
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <TextField name="code" label="Code" autoComplete="one-time-code" maxLength={11} state={state} hint="The 6-digit code from your authenticator app, or one of your recovery codes." />
      <div>
        <SubmitButton pendingText="Checking…">Verify</SubmitButton>
      </div>
    </form>
  )
}
