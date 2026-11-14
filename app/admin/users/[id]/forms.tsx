"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { resetTwoFactorAction, setRoleAction, setStoreStatusAction, setUserStatusAction } from "../actions"

export function StatusForm({ userId, kind, suspended, label }: { userId: string; kind: "user" | "store"; suspended: boolean; label: string }) {
  const [state, action] = useActionState(kind === "user" ? setUserStatusAction : setStoreStatusAction, initialFormState)
  return (
    <form action={action} className="grid gap-2" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
      {suspended ? null : <TextField name="reason" label="Reason (kept in the audit log)" maxLength={300} state={state} />}
      <div>
        <SubmitButton size="sm" variant="outline" className={suspended ? "" : "text-destructive"} pendingText="Saving…">
          {label}
        </SubmitButton>
      </div>
    </form>
  )
}

export function RoleForm({ userId, toRole, label }: { userId: string; toRole: "ops_admin" | "customer"; label: string }) {
  const [state, action] = useActionState(setRoleAction, initialFormState)
  return (
    <form action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={toRole} />
      <div>
        <SubmitButton size="sm" variant="outline" pendingText="Saving…">
          {label}
        </SubmitButton>
      </div>
    </form>
  )
}

export function ResetTwoFactorForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(resetTwoFactorAction, initialFormState)
  return (
    <form action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="userId" value={userId} />
      <div>
        <SubmitButton size="sm" variant="outline" pendingText="Resetting…">
          Reset two-factor sign-in
        </SubmitButton>
      </div>
    </form>
  )
}
