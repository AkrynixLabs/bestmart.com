"use client"

import { useActionState, useId, useState } from "react"

import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/form-fields"
import { initialFormState, type FormState } from "@/lib/actions/state"
import { attributeField } from "@/lib/catalog/product-rules"

import { updateProductDetailsAction } from "../actions"

type Attribute = {
  id: string
  key: string
  name: string
  type: "text" | "number" | "select" | "multiselect" | "boolean"
  unit: string | null
  options: string[]
  isRequired: boolean
}
type Value = { textValues: string[]; numberValue: number | null; booleanValue: boolean | null }

export function DetailsForm({
  productId,
  title,
  description,
  attributes,
  values,
}: {
  productId: string
  title: string
  description: string
  attributes: Attribute[]
  values: Record<string, Value>
}) {
  const [state, action] = useActionState(updateProductDetailsAction, initialFormState)
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <TextField name="title" label="Product name" required maxLength={120} defaultValue={title} state={state} />
      <TextAreaField
        name="description"
        label="Description"
        rows={8}
        maxLength={5000}
        defaultValue={description}
        state={state}
        hint="What it is, what it's made of, sizes, what's in the box, care instructions. At least 20 characters to publish."
      />
      {attributes.length > 0 ? (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-medium">Specifications</legend>
          {attributes.map((a) => (
            <AttributeInput key={a.id} attribute={a} value={values[a.id]} state={state} />
          ))}
        </fieldset>
      ) : null}
      <div>
        <SubmitButton pendingText="Saving…">Save details</SubmitButton>
      </div>
    </form>
  )
}

function AttributeInput({ attribute: a, value, state }: { attribute: Attribute; value?: Value; state: FormState }) {
  const name = attributeField(a.key)
  const label = a.isRequired ? `${a.name} (required)` : a.name
  switch (a.type) {
    case "text":
      return <TextField name={name} label={label} maxLength={120} defaultValue={value?.textValues[0] ?? ""} state={state} />
    case "number":
      return (
        <TextField
          name={name}
          label={a.unit ? `${label}, ${a.unit}` : label}
          inputMode="decimal"
          defaultValue={value?.numberValue === null || value?.numberValue === undefined ? "" : String(value.numberValue)}
          state={state}
        />
      )
    case "select":
      return <SelectField name={name} label={label} options={[["", "Not specified"], ...a.options.map((o) => [o, o] as [string, string])]} defaultValue={value?.textValues[0] ?? ""} state={state} />
    case "boolean":
      return (
        <SelectField
          name={name}
          label={label}
          options={[
            ["", "Not specified"],
            ["yes", "Yes"],
            ["no", "No"],
          ]}
          defaultValue={value?.booleanValue === null || value?.booleanValue === undefined ? "" : value.booleanValue ? "yes" : "no"}
          state={state}
        />
      )
    case "multiselect":
      return <MultiSelect attribute={a} initial={value?.textValues ?? []} error={state.fieldErrors?.[name]} />
  }
}

/** Controlled checkboxes, so a failed save doesn't clear the ticks. */
function MultiSelect({ attribute: a, initial, error }: { attribute: Attribute; initial: string[]; error?: string }) {
  const [picked, setPicked] = useState<string[]>(initial)
  const id = useId()
  const name = attributeField(a.key)
  return (
    <fieldset className="grid gap-1.5 sm:col-span-2" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-sm font-medium">{a.isRequired ? `${a.name} (required)` : a.name}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {a.options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={option}
              checked={picked.includes(option)}
              onChange={(e) => setPicked((p) => (e.target.checked ? [...p, option] : p.filter((x) => x !== option)))}
              className="size-4 accent-[var(--brand-blue)]"
            />
            {option}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
