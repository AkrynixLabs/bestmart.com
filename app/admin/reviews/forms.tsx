"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { setReviewVisibilityAction } from "./actions"

export function VisibilityForm({ reviewId, hidden }: { reviewId: string; hidden: boolean }) {
  const [state, action] = useActionState(setReviewVisibilityAction, initialFormState)
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="hide" value={hidden ? "false" : "true"} />
      {hidden ? null : <TextField name="reason" label="Reason to hide" maxLength={300} state={state} className="min-w-64" />}
      <SubmitButton size="sm" variant="outline" className={hidden ? "" : "text-destructive"} pendingText="Saving…">
        {hidden ? "Show again" : "Hide review"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  )
}
