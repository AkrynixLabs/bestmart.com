"use client"

import { useActionState, useState } from "react"

import { CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"
import { ATTRIBUTE_TYPES } from "@/lib/validation/catalog"

import { deleteAttributeAction, saveAttributeAction } from "./actions"

export type AttributeFormValues = {
  id?: string
  key: string
  name: string
  type: string
  unit: string
  options: string
  isRequired: boolean
  isFilterable: boolean
  sortOrder: string
}

const EMPTY: AttributeFormValues = { key: "", name: "", type: "select", unit: "", options: "", isRequired: false, isFilterable: true, sortOrder: "0" }

export function AttributeForm({ categoryId, initial = EMPTY, usedBy = 0 }: { categoryId: string; initial?: AttributeFormValues; usedBy?: number }) {
  const [state, action] = useActionState(saveAttributeAction, initialFormState)
  const [type, setType] = useState(state.values?.type ?? initial.type)
  const isList = type === "select" || type === "multiselect"
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="categoryId" value={categoryId} />
      {initial.id ? <input type="hidden" name="attributeId" value={initial.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="name" label="Name" required maxLength={40} defaultValue={initial.name} state={state} placeholder="e.g. Brand" />
        {initial.id ? (
          <TextField name="keyDisplay" label="Key" value={initial.key} readOnly disabled hint="Fixed once created (used in filter links)." />
        ) : (
          <TextField name="key" label="Key (optional)" maxLength={40} state={state} placeholder="made from the name" hint="Lower-case, e.g. screen_size." />
        )}
        <SelectField
          name="type"
          label="Type"
          options={ATTRIBUTE_TYPES}
          value={type}
          onChange={(e) => setType(e.target.value)}
          state={state}
          disabled={usedBy > 0}
          hint={usedBy > 0 ? `Used by ${usedBy} product(s); the type can't change.` : undefined}
        />
        {usedBy > 0 ? <input type="hidden" name="type" value={type} /> : null}
      </div>
      {isList ? (
        <TextAreaField
          name="options"
          label="Choices"
          rows={2}
          defaultValue={initial.options}
          state={state}
          placeholder="Samsung, Apple, Tecno, Infinix"
          hint="Separate with commas or new lines."
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {type === "number" ? <TextField name="unit" label="Unit (optional)" maxLength={12} defaultValue={initial.unit} state={state} placeholder="GB, inches, kg" /> : null}
        <TextField name="sortOrder" label="Sort order" inputMode="numeric" defaultValue={initial.sortOrder} state={state} />
      </div>
      <div className="flex flex-wrap gap-6">
        <CheckboxField name="isRequired" label="Required to publish" defaultChecked={initial.isRequired} state={state} />
        <CheckboxField name="isFilterable" label="Shoppers can filter by it" defaultChecked={initial.isFilterable} state={state} />
      </div>
      <div>
        <SubmitButton size="sm" pendingText="Saving…">
          {initial.id ? "Save attribute" : "Add attribute"}
        </SubmitButton>
      </div>
    </form>
  )
}

export function DeleteAttributeForm({ attributeId, usedBy }: { attributeId: string; usedBy: number }) {
  const [state, action] = useActionState(deleteAttributeAction, initialFormState)
  return (
    <form action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="attributeId" value={attributeId} />
      {usedBy > 0 ? <CheckboxField name="confirm" label={`Also delete the values on ${usedBy} product(s)`} /> : null}
      <div>
        <SubmitButton size="sm" variant="outline" className="text-destructive" pendingText="Deleting…">
          Delete attribute
        </SubmitButton>
      </div>
    </form>
  )
}
