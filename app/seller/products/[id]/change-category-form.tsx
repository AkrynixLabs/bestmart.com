"use client"

import { useActionState } from "react"

import { FormMessage, SelectField, SubmitButton } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { changeProductCategoryAction } from "../actions"

export function ChangeCategoryForm({ productId, categoryId, categories }: { productId: string; categoryId: string; categories: [string, string][] }) {
  const [state, action] = useActionState(changeProductCategoryAction, initialFormState)
  const current = categories.some(([id]) => id === categoryId) ? categoryId : ""
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <SelectField
        name="categoryId"
        label="Category"
        options={categories}
        defaultValue={current}
        placeholder={current ? undefined : "Choose a new category"}
        state={state}
        hint="Attribute values that don't apply to the new category are removed."
      />
      <div>
        <SubmitButton variant="outline" pendingText="Moving…">
          Change category
        </SubmitButton>
      </div>
    </form>
  )
}
