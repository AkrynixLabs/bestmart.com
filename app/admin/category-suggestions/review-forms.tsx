"use client"

import { useActionState } from "react"

import { FormMessage, SelectField, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { acceptSuggestionAction, declineSuggestionAction } from "./actions"

export function SuggestionReview({ id, name, parentId, parents }: { id: string; name: string; parentId: string; parents: [string, string][] }) {
  const [acceptState, accept] = useActionState(acceptSuggestionAction, initialFormState)
  const [declineState, decline] = useActionState(declineSuggestionAction, initialFormState)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form action={accept} className="grid gap-3" noValidate>
        <FormMessage state={acceptState} />
        <input type="hidden" name="suggestionId" value={id} />
        <TextField name="name" label="Category name" defaultValue={name} maxLength={60} state={acceptState} />
        <SelectField name="parentId" label="Parent" options={[["", "Top level"], ...parents]} defaultValue={parentId} state={acceptState} />
        <TextField name="response" label="Note to the seller (optional)" maxLength={500} state={acceptState} />
        <div>
          <SubmitButton size="sm" pendingText="Adding…">
            Add category
          </SubmitButton>
        </div>
      </form>
      <form action={decline} className="grid content-start gap-3" noValidate>
        <FormMessage state={declineState} />
        <input type="hidden" name="suggestionId" value={id} />
        <TextField name="response" label="Reason (sent to the seller, optional)" maxLength={500} state={declineState} placeholder="e.g. Use Home & Living › Kitchen instead" />
        <div>
          <SubmitButton size="sm" variant="outline" pendingText="Declining…">
            Decline
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}
