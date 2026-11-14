"use client"

import { useActionState } from "react"

import { FormMessage, SelectField, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { saveGeneralSettingsAction } from "./actions"

export type GeneralSettings = Record<
  | "commissionPercent"
  | "stockReservationMinutes"
  | "shipWithinDays"
  | "autoConfirmDeliveryDays"
  | "payoutHoldDays"
  | "returnWindowDays"
  | "lowStockThreshold"
  | "payoutMinimum"
  | "payoutWeekday"
  | "supportEmail"
  | "supportPhone",
  string
>

const WEEKDAYS: [string, string][] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => [String(i), d])

export function GeneralSettingsForm({ initial }: { initial: GeneralSettings }) {
  const [state, action] = useActionState(saveGeneralSettingsAction, initialFormState)
  const field = (name: keyof GeneralSettings, label: string, hint?: string, inputMode: "numeric" | "decimal" = "numeric") => (
    <TextField name={name} label={label} defaultValue={initial[name]} inputMode={inputMode} state={state} hint={hint} />
  )
  return (
    <form action={action} className="grid gap-6" noValidate>
      <FormMessage state={state} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-medium">Money</legend>
        {field("commissionPercent", "Default commission (%)", "On item prices; categories can override it.", "decimal")}
        {field("payoutMinimum", "Smallest payout (GH₵)", undefined, "decimal")}
        <SelectField name="payoutWeekday" label="Payout batch day" options={WEEKDAYS} defaultValue={initial.payoutWeekday} state={state} />
        {field("payoutHoldDays", "Hold after delivery (days)", "Before a seller's earnings become available.")}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-medium">Orders</legend>
        {field("stockReservationMinutes", "Time to pay (minutes)", "Stock is held this long after checkout.")}
        {field("shipWithinDays", "Ship within (days)", "After this, the buyer may cancel for a refund.")}
        {field("autoConfirmDeliveryDays", "Auto-confirm after shipping (days)")}
        {field("returnWindowDays", "Return window after delivery (days)")}
        {field("lowStockThreshold", "Low-stock warning at (units)")}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-medium">Support contacts</legend>
        <TextField name="supportEmail" label="Support email" type="email" defaultValue={initial.supportEmail} state={state} />
        <TextField name="supportPhone" label="Support phone" type="tel" defaultValue={initial.supportPhone} state={state} />
      </fieldset>
      <div>
        <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  )
}
