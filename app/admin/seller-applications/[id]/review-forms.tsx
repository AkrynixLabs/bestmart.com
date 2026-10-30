"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextAreaField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { approveApplicationAction, rejectApplicationAction } from "../../actions"

export function ReviewForms({ applicationId }: { applicationId: string }) {
  const [approveState, approve] = useActionState(approveApplicationAction, initialFormState)
  const [rejectState, reject] = useActionState(rejectApplicationAction, initialFormState)
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4">
      <form action={approve} className="grid gap-3">
        <FormMessage state={approveState} />
        <input type="hidden" name="applicationId" value={applicationId} />
        <SubmitButton pendingText="Approving…">Approve and create store</SubmitButton>
      </form>
      <div className="h-px bg-border" />
      <form action={reject} className="grid gap-3" noValidate>
        <FormMessage state={rejectState} />
        <input type="hidden" name="applicationId" value={applicationId} />
        <TextAreaField name="reason" label="Reason for rejection" rows={3} state={rejectState} hint="Sent to the applicant. Say what to fix so they can re-apply." />
        <SubmitButton variant="outline" className="text-destructive" pendingText="Rejecting…">
          Reject
        </SubmitButton>
      </form>
    </div>
  )
}
