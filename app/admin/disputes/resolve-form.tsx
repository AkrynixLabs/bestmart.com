"use client"

import { useActionState, useState } from "react"

import { FormMessage, SelectField, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { resolveDisputeAction } from "./actions"

export function ResolveDisputeForm({ disputeId, maxLabel }: { disputeId: string; maxLabel: string }) {
  const [state, action] = useActionState(resolveDisputeAction, initialFormState)
  const [outcome, setOutcome] = useState(state.values?.outcome ?? "")
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="disputeId" value={disputeId} />
      <SelectField
        name="outcome"
        label="Outcome"
        placeholder="Choose"
        options={[
          ["full_refund", `Full refund (${maxLabel})`],
          ["partial_refund", "Partial refund"],
          ["rejected", "No refund"],
        ]}
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        state={state}
      />
      {outcome === "partial_refund" ? <TextField name="amount" label="Refund amount (GH₵)" inputMode="decimal" state={state} hint={`Up to ${maxLabel}`} /> : null}
      <TextField name="note" label="Note to the buyer and seller (optional)" maxLength={500} state={state} />
      <div>
        <SubmitButton size="sm" pendingText="Resolving…">
          Resolve
        </SubmitButton>
      </div>
    </form>
  )
}
