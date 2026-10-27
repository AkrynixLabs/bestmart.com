"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { resendVerificationAction } from "../../actions"

export function ResendForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerificationAction, initialFormState)
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" defaultValue={email} required state={state} />
      <SubmitButton variant="secondary" pendingText="Sending…">
        Send a new link
      </SubmitButton>
    </form>
  )
}
