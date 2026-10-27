"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"
import { PASSWORD_MIN } from "@/lib/validation/auth"

import { changePasswordAction, updateProfileAction } from "./actions"

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action] = useActionState(updateProfileAction, initialFormState)
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField name="name" label="Full name" autoComplete="name" defaultValue={name} required state={state} />
      <TextField name="phone" label="Phone number" type="tel" autoComplete="tel" defaultValue={phone} placeholder="024 123 4567" state={state} />
      <SubmitButton className="justify-self-start" pendingText="Saving…">
        Save details
      </SubmitButton>
    </form>
  )
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState(changePasswordAction, initialFormState)
  return (
    <form action={action} className="grid gap-4" noValidate key={state.success ?? "form"}>
      <FormMessage state={state} />
      {hasPassword ? <TextField name="currentPassword" label="Current password" type="password" autoComplete="current-password" required state={state} /> : null}
      <TextField name="newPassword" label="New password" type="password" autoComplete="new-password" required state={state} hint={`At least ${PASSWORD_MIN} characters, with a letter and a number.`} />
      <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required state={state} />
      <SubmitButton className="justify-self-start" pendingText="Saving…">
        {hasPassword ? "Change password" : "Set password"}
      </SubmitButton>
    </form>
  )
}
