"use client"

import { useActionState } from "react"

import { FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { LocationPicker } from "@/components/maps/location-picker"
import { initialFormState } from "@/lib/actions/state"

import { savePickupAction } from "./actions"

export function PickupForm({ area, pin, city }: { area: string; pin: { lat: number; lng: number } | null; city: string }) {
  const [state, action] = useActionState(savePickupAction, initialFormState)
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField name="pickupArea" label="Area or suburb" defaultValue={area} placeholder="e.g. Madina" maxLength={80} state={state} hint={`Your town is ${city}. The area makes the estimate closer when there's no map pin.`} />
      <LocationPicker initial={pin} error={state.fieldErrors?.latitude} hint="Drop the pin where riders collect orders. Without it, delivery fees are estimated from your area and town." />
      <div>
        <SubmitButton pendingText="Saving…">Save pickup location</SubmitButton>
      </div>
    </form>
  )
}
