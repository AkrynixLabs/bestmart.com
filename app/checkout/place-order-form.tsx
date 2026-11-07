"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { placeOrderAction } from "./actions"

export function PlaceOrderForm({ addressId, idempotencyKey, total, disabled }: { addressId: string | null; idempotencyKey: string; total: string; disabled: boolean }) {
  const [state, action] = useActionState(placeOrderAction, initialFormState)
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      {addressId ? <input type="hidden" name="addressId" value={addressId} /> : null}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <SubmitButton size="lg" className="w-full" disabled={disabled || !addressId} pendingText="Placing your order…">
        Place order · {total}
      </SubmitButton>
    </form>
  )
}
