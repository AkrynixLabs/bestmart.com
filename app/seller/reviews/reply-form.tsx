"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextAreaField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { replyAction } from "./actions"

export function ReplyForm({ reviewId }: { reviewId: string }) {
  const [state, action] = useActionState(replyAction, initialFormState)
  if (state.success) return <FormMessage state={state} />
  return (
    <form action={action} className="grid gap-2" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="reviewId" value={reviewId} />
      <TextAreaField name="reply" label="Public reply (once)" rows={2} maxLength={1000} state={state} />
      <div>
        <SubmitButton size="sm" variant="outline" pendingText="Posting…">
          Post reply
        </SubmitButton>
      </div>
    </form>
  )
}
