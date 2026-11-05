"use client"

import { useActionState } from "react"

import { FormMessage, SelectField, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { createProductAction } from "../actions"

export function NewProductForm({ categories }: { categories: [string, string][] }) {
  const [state, action] = useActionState(createProductAction, initialFormState)
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField name="title" label="Product name" required maxLength={120} state={state} placeholder="e.g. Handwoven kente stole" />
      <SelectField name="categoryId" label="Category" options={categories} placeholder="Choose a category" state={state} />
      <div>
        <SubmitButton pendingText="Creating…">Continue</SubmitButton>
      </div>
    </form>
  )
}
