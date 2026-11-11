"use client"

import { useActionState, useState } from "react"

import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { acceptOrderAction, respondToDisputeAction, sellerCancelAction, shipOrderAction } from "../actions"

export function AcceptForm({ subOrderId }: { subOrderId: string }) {
  const [state, action] = useActionState(acceptOrderAction, initialFormState)
  return (
    <form action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="subOrderId" value={subOrderId} />
      <div>
        <SubmitButton variant="outline" pendingText="Accepting…">
          Accept and start preparing
        </SubmitButton>
      </div>
    </form>
  )
}

export function ShipForm({ subOrderId }: { subOrderId: string }) {
  const [state, action] = useActionState(shipOrderAction, initialFormState)
  const [method, setMethod] = useState(state.values?.method ?? "own_rider")
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="subOrderId" value={subOrderId} />
      <SelectField
        name="method"
        label="How is it being delivered?"
        options={[
          ["own_rider", "My own rider"],
          ["courier", "A courier company"],
        ]}
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        state={state}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="carrierName" label={method === "courier" ? "Courier name" : "Rider's name"} maxLength={80} state={state} placeholder={method === "courier" ? "e.g. VIP Parcel, DHL" : "e.g. Kojo"} />
        <TextField name="riderPhone" label={method === "courier" ? "Phone (optional)" : "Rider's phone"} type="tel" state={state} placeholder="024 123 4567" />
      </div>
      {method === "courier" ? <TextField name="trackingNumber" label="Tracking number" maxLength={80} state={state} hint="Or give a phone number above." /> : null}
      <div>
        <SubmitButton pendingText="Saving…">Mark as shipped</SubmitButton>
      </div>
    </form>
  )
}

export function SellerCancelForm({ subOrderId }: { subOrderId: string }) {
  const [state, action] = useActionState(sellerCancelAction, initialFormState)
  return (
    <form action={action} className="grid gap-2" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="subOrderId" value={subOrderId} />
      <TextField name="reason" label="Reason (the buyer sees it)" maxLength={300} state={state} placeholder="e.g. Out of stock after all" />
      <div>
        <SubmitButton size="sm" variant="outline" className="text-destructive" pendingText="Cancelling…">
          Cancel and refund the buyer
        </SubmitButton>
      </div>
    </form>
  )
}

export function DisputeResponseForm({ subOrderId, disputeId, current }: { subOrderId: string; disputeId: string; current: string | null }) {
  const [state, action] = useActionState(respondToDisputeAction, initialFormState)
  return (
    <form action={action} className="grid gap-2" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="subOrderId" value={subOrderId} />
      <input type="hidden" name="disputeId" value={disputeId} />
      <TextAreaField name="response" label="Your side (for our team)" rows={3} maxLength={1000} defaultValue={current ?? ""} state={state} />
      <div>
        <SubmitButton size="sm" variant="outline" pendingText="Sending…">
          {current ? "Update response" : "Send response"}
        </SubmitButton>
      </div>
    </form>
  )
}
