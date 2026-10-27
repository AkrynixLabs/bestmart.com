"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { verifyEmailAction } from "../actions"

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action] = useActionState(verifyEmailAction, initialFormState)
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full" pendingText="Confirming…">
        Confirm my email
      </SubmitButton>
    </form>
  )
}
