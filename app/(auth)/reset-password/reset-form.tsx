"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"
import { PASSWORD_MIN } from "@/lib/validation/auth"

import { resetPasswordAction } from "../actions"

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialFormState)
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <TextField name="password" label="New password" type="password" autoComplete="new-password" required state={state} hint={`At least ${PASSWORD_MIN} characters, with a letter and a number.`} />
      <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required state={state} />
      <SubmitButton className="w-full" pendingText="Saving…">
        Save new password
      </SubmitButton>
    </form>
  )
}
