"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { blockProductAction, unblockProductAction } from "./actions"

export function BlockForm({ productId }: { productId: string }) {
  const [state, action] = useActionState(blockProductAction, initialFormState)
  return (
    <form action={action} className="grid gap-2" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <TextField name="reason" label="Reason (sent to the seller)" maxLength={500} state={state} placeholder="e.g. Counterfeit branded goods aren't allowed" />
      <div>
        <SubmitButton size="sm" variant="outline" className="text-destructive" pendingText="Blocking…">
          Block listing
        </SubmitButton>
      </div>
    </form>
  )
}

export function UnblockForm({ productId }: { productId: string }) {
  const [state, action] = useActionState(unblockProductAction, initialFormState)
  return (
    <form action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <div>
        <SubmitButton size="sm" variant="outline" pendingText="Unblocking…">
          Unblock
        </SubmitButton>
      </div>
    </form>
  )
}
