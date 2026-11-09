"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { refundAction } from "../actions"

export function RefundForm({ subOrderId, maxLabel }: { subOrderId: string; maxLabel: string }) {
  const [state, action] = useActionState(refundAction, initialFormState)
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="subOrderId" value={subOrderId} />
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <TextField name="amount" label="Amount (GH₵)" inputMode="decimal" state={state} hint={`Up to ${maxLabel}`} />
        <TextField name="reason" label="Reason (sent to the buyer)" maxLength={300} state={state} placeholder="e.g. Item arrived damaged" />
      </div>
      <div>
        <SubmitButton size="sm" variant="outline" pendingText="Refunding…">
          Refund
        </SubmitButton>
      </div>
    </form>
  )
}
