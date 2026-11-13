"use client"

import { useActionState } from "react"

import { CheckboxField, FormMessage, SelectField, SubmitButton } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { approveBatchAction, cancelBatchAction, prepareBatchAction, setBankCodeAction } from "./actions"

export function PrepareForm() {
  const [state, action] = useActionState(prepareBatchAction, initialFormState)
  return (
    <form action={action} className="grid gap-2">
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="outline" pendingText="Preparing…">
          Prepare a batch now
        </SubmitButton>
      </div>
    </form>
  )
}

export function ApproveForm({ batchId, total }: { batchId: string; total: string }) {
  const [state, action] = useActionState(approveBatchAction, initialFormState)
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="batchId" value={batchId} />
      <CheckboxField name="confirm" label={`I've checked these payouts. Send ${total} now.`} />
      <div>
        <SubmitButton pendingText="Sending payouts…">Approve and send</SubmitButton>
      </div>
    </form>
  )
}

export function CancelBatchForm({ batchId }: { batchId: string }) {
  const [state, action] = useActionState(cancelBatchAction, initialFormState)
  return (
    <form action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="batchId" value={batchId} />
      <div>
        <SubmitButton size="sm" variant="ghost" pendingText="Cancelling…">
          Cancel this draft
        </SubmitButton>
      </div>
    </form>
  )
}

export function BankCodeForm({ storeId, banks }: { storeId: string; banks: [string, string][] }) {
  const [state, action] = useActionState(setBankCodeAction, initialFormState)
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="storeId" value={storeId} />
      <SelectField name="bankCode" label="Bank" options={banks} placeholder="Choose the bank" state={state} className="min-w-56" />
      <SubmitButton size="sm" variant="outline" pendingText="Saving…">
        Save bank
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  )
}
