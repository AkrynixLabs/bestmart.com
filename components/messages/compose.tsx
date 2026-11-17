"use client"

import { useActionState, useEffect, useRef } from "react"

import { FormMessage, SubmitButton, TextAreaField } from "@/components/forms/form-fields"
import { initialFormState, type FormState } from "@/lib/actions/state"

/** Message box; hidden fields carry the thread or store and any product/order context. */
export function Compose({ action, hidden, label = "Message" }: { action: (prev: FormState, data: FormData) => Promise<FormState>; hidden: Record<string, string>; label?: string }) {
  const [state, formAction] = useActionState(action, initialFormState)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.success) ref.current?.reset()
  }, [state])
  return (
    <form ref={ref} action={formAction} className="grid gap-2" noValidate>
      <FormMessage state={state.success ? initialFormState : state} />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <TextAreaField name="body" label={label} rows={3} maxLength={2000} state={state} />
      <div>
        <SubmitButton pendingText="Sending…">Send</SubmitButton>
      </div>
    </form>
  )
}
