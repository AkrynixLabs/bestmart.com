"use client"

import { useActionState } from "react"

import { CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"
import { shrinkFileInput } from "@/lib/client/resize-image"

import { deleteCategoryAction, saveCategoryAction } from "./actions"

export type CategoryFormValues = {
  id?: string
  name: string
  slug: string
  parentId: string
  description: string
  status: "active" | "hidden"
  commissionPercent: string
  sortOrder: string
  seoTitle: string
  seoDescription: string
  imageUrl: string | null
}

export function CategoryForm({
  initial,
  parentOptions,
  canEditCommission,
  platformCommission,
}: {
  initial: CategoryFormValues
  parentOptions: [string, string][]
  canEditCommission: boolean
  platformCommission: string
}) {
  const [state, action] = useActionState(saveCategoryAction, initialFormState)
  return (
    <form action={action} className="grid gap-6" noValidate>
      <FormMessage state={state} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Name" required maxLength={60} defaultValue={initial.name} state={state} />
        <TextField
          name="slug"
          label="Web address"
          defaultValue={initial.slug}
          state={state}
          placeholder="made from the name"
          hint={initial.id ? "Changing it keeps the old address working (it redirects)." : "Leave empty to make one from the name."}
        />
        <SelectField name="parentId" label="Parent category" options={[["", "None (top level)"], ...parentOptions]} defaultValue={initial.parentId} state={state} />
        <SelectField
          name="status"
          label="Status"
          options={[
            ["active", "Live on the storefront"],
            ["hidden", "Hidden"],
          ]}
          defaultValue={initial.status}
          state={state}
          hint="Hiding also hides its subcategories and their products."
        />
      </div>

      <TextAreaField name="description" label="Description (optional)" rows={3} maxLength={500} defaultValue={initial.description} state={state} hint="Shown at the top of the category page." />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="commissionPercent"
          label="Commission override (%)"
          inputMode="decimal"
          defaultValue={initial.commissionPercent}
          state={state}
          placeholder={`inherit (platform: ${platformCommission}%)`}
          disabled={!canEditCommission}
          hint={canEditCommission ? "Leave empty to inherit from the parent or the platform default." : "Only the Super Admin can change commission."}
        />
        {!canEditCommission ? <input type="hidden" name="commissionPercent" value={initial.commissionPercent} /> : null}
        <TextField name="sortOrder" label="Sort order" inputMode="numeric" defaultValue={initial.sortOrder} state={state} hint="Lower numbers come first." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="seoTitle" label="Search engine title (optional)" maxLength={70} defaultValue={initial.seoTitle} state={state} />
        <TextField name="seoDescription" label="Search engine description (optional)" maxLength={160} defaultValue={initial.seoDescription} state={state} />
      </div>

      <div className="grid gap-2">
        {initial.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initial.imageUrl} alt="" className="h-24 w-36 rounded-md border object-cover" />
        ) : null}
        <TextField
          name="image"
          label={initial.imageUrl ? "Replace image" : "Image (optional)"}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          state={state}
          onChange={(e) => void shrinkFileInput(e.currentTarget, 1200)}
          hint="Shown on category tiles. Landscape photos work best."
        />
        {initial.imageUrl ? <CheckboxField name="removeImage" label="Remove the current image" /> : null}
      </div>

      <div>
        <SubmitButton pendingText="Saving…">{initial.id ? "Save category" : "Create category"}</SubmitButton>
      </div>
    </form>
  )
}

export function DeleteCategoryForm({ id }: { id: string }) {
  const [state, action] = useActionState(deleteCategoryAction, initialFormState)
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-muted-foreground">Only possible when it has no subcategories and no products. Otherwise, hide it.</p>
      <div>
        <SubmitButton variant="outline" className="text-destructive" pendingText="Deleting…">
          Delete category
        </SubmitButton>
      </div>
    </form>
  )
}
