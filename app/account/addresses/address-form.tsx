"use client"

import { useActionState } from "react"
import Link from "next/link"

import { CheckboxField, FormMessage, SelectField, SubmitButton, TextField } from "@/components/forms/form-fields"
import { LocationPicker } from "@/components/maps/location-picker"
import { Button } from "@/components/ui/button"
import { initialFormState } from "@/lib/actions/state"
import { ghanaRegions } from "@/lib/validation/common"

import { saveAddressAction } from "../actions"

export type AddressDefaults = Partial<Record<"label" | "recipientName" | "phone" | "region" | "city" | "area" | "streetAddress" | "landmark" | "gpsAddress", string>> & {
  isDefault?: boolean
  pin?: { lat: number; lng: number } | null
}

export function AddressForm({ addressId, defaults = {}, returnTo }: { addressId?: string; defaults?: AddressDefaults; returnTo?: "/checkout" }) {
  const [state, action] = useActionState(saveAddressAction, initialFormState)
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      {addressId ? <input type="hidden" name="addressId" value={addressId} /> : null}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="recipientName" label="Recipient name" autoComplete="name" defaultValue={defaults.recipientName} required state={state} />
        <TextField name="phone" label="Phone number" type="tel" autoComplete="tel" defaultValue={defaults.phone} placeholder="024 123 4567" required state={state} />
        <SelectField name="region" label="Region" options={ghanaRegions} placeholder="Choose a region" defaultValue={defaults.region} required state={state} />
        <TextField name="city" label="Town or city" autoComplete="address-level2" defaultValue={defaults.city} placeholder="Accra" required state={state} />
        <TextField name="area" label="Area or suburb" autoComplete="address-level3" defaultValue={defaults.area} placeholder="East Legon" required state={state} />
        <TextField name="gpsAddress" label="GhanaPost GPS address (optional)" defaultValue={defaults.gpsAddress} placeholder="GA-123-4567" state={state} hint="Helps riders find you." />
      </div>
      <TextField name="streetAddress" label="House number and street (optional)" autoComplete="street-address" defaultValue={defaults.streetAddress} state={state} />
      <TextField name="landmark" label="Nearest landmark (optional)" defaultValue={defaults.landmark} placeholder="Opposite the Shell filling station" state={state} />
      <LocationPicker
        initial={state.values?.latitude && state.values?.longitude ? { lat: Number(state.values.latitude), lng: Number(state.values.longitude) } : defaults.pin}
        error={state.fieldErrors?.latitude}
        hint="Tap the map where the rider should come, or use your location. It makes the delivery fee exact; without it we estimate from the area and town."
      />
      <TextField name="label" label="Label (optional)" defaultValue={defaults.label} placeholder="Home, Office…" state={state} />
      <CheckboxField name="isDefault" label="Use as my default delivery address" defaultChecked={defaults.isDefault} state={state} />
      <div className="flex gap-3">
        <SubmitButton pendingText="Saving…">Save address</SubmitButton>
        <Button asChild variant="ghost">
          <Link href={returnTo ?? "/account/addresses"}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
