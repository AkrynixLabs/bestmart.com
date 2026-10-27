"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { forgotPasswordAction } from "../actions"

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialFormState)
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <SubmitButton className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  )
}
