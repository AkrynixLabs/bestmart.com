"use client"

import { useActionState, useState } from "react"
import Link from "next/link"

import { CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"
import { shrinkFileInput } from "@/lib/client/resize-image"
import { ghanaRegions } from "@/lib/validation/common"
import { MOBILE_MONEY_PROVIDERS } from "@/lib/validation/seller"

import { submitSellerApplicationAction } from "./actions"

const BUSINESS_TYPES = [
  ["individual", "Individual (selling in my own name)"],
  ["registered_business", "Registered business"],
] as const

const PAYOUT_METHODS = [
  ["mobile_money", "Mobile Money"],
  ["bank_account", "Bank account"],
] as const

export function ApplicationForm({ defaults, commissionPercent }: { defaults: { phone: string; payoutAccountName: string }; commissionPercent: string }) {
  const [state, action] = useActionState(submitSellerApplicationAction, initialFormState)
  const [businessType, setBusinessType] = useState(state.values?.businessType ?? "individual")
  const [payoutMethod, setPayoutMethod] = useState(state.values?.payoutMethod ?? "mobile_money")

  return (
    <form action={action} className="grid gap-8" noValidate>
      <FormMessage state={state} />

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold">Your store</legend>
        <TextField name="storeName" label="Store name" required state={state} hint="Shown to buyers. 3 to 80 characters." />
        <SelectField name="businessType" label="Business type" options={BUSINESS_TYPES} state={state} value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
        {businessType === "registered_business" ? (
          <TextField name="businessRegistrationNumber" label="Business registration number" required state={state} hint="From the Office of the Registrar of Companies." />
        ) : null}
        <TextAreaField name="categoriesNote" label="What do you plan to sell? (optional)" rows={3} state={state} />
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold">Contact and location</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="phone" label="Business phone" type="tel" defaultValue={defaults.phone} placeholder="024 123 4567" required state={state} />
          <SelectField name="region" label="Region" options={ghanaRegions} placeholder="Choose a region" required state={state} />
          <TextField name="city" label="Town or city" placeholder="Accra" required state={state} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold">Identity check</legend>
        <TextField name="ghanaCardNumber" label="Ghana Card number" placeholder="GHA-123456789-0" required state={state} autoComplete="off" />
        <TextField
          name="ghanaCardImage"
          label="Photo or scan of your Ghana Card (front)"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
          state={state}
          onChange={(e) => void shrinkFileInput(e.currentTarget)}
          hint="A clear photo (we shrink it for you) or a PDF up to 4 MB. Only BestMart's review team can see it."
        />
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold">How you get paid</legend>
        <SelectField name="payoutMethod" label="Payout method" options={PAYOUT_METHODS} state={state} value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          {payoutMethod === "mobile_money" ? (
            <SelectField
              key="momo"
              name="payoutProvider"
              label="Network"
              options={MOBILE_MONEY_PROVIDERS.map((p) => [p, p] as const)}
              placeholder="Choose a network"
              required
              state={state}
            />
          ) : (
            <TextField key="bank" name="payoutProvider" label="Bank name" placeholder="e.g. GCB Bank" required state={state} />
          )}
          <TextField name="payoutAccountNumber" label={payoutMethod === "mobile_money" ? "MoMo number" : "Account number"} inputMode="numeric" required state={state} />
          <TextField name="payoutAccountName" label="Account name" defaultValue={defaults.payoutAccountName} required state={state} hint="Must match the name on the account." />
        </div>
      </fieldset>

      <CheckboxField
        name="agreeToSellerTerms"
        state={state}
        label={
          <>
            I confirm these details are true and agree to the{" "}
            <Link href="/terms#sellers" className="text-primary underline" target="_blank">
              seller terms
            </Link>
            , including the {commissionPercent}% commission on each sale.
          </>
        }
      />
      <SubmitButton className="justify-self-start" size="lg" pendingText="Submitting…">
        Submit application
      </SubmitButton>
    </form>
  )
}
