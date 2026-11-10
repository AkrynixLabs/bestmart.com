"use client"

import { useActionState } from "react"

import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { suggestCategoryAction } from "./actions"

export function SuggestCategoryForm({ parents }: { parents: [string, string][] }) {
  const [state, action] = useActionState(suggestCategoryAction, initialFormState)
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField name="name" label="Category name" required maxLength={60} state={state} placeholder="e.g. Kitchen appliances" />
      <SelectField name="parentId" label="Where should it go?" options={[["", "A new top-level category"], ...parents]} defaultValue="" state={state} />
      <TextAreaField name="note" label="What would you sell there? (optional)" rows={3} maxLength={500} state={state} />
      <div>
        <SubmitButton pendingText="Sending…">Send suggestion</SubmitButton>
      </div>
    </form>
  )
}
