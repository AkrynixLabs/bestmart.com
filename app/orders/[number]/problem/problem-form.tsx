"use client"

import { useActionState, useState } from "react"

import { FormMessage, SelectField, SubmitButton, TextAreaField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"
import { resizeImage } from "@/lib/client/resize-image"

import { openDisputeAction } from "../../actions"

export function ProblemForm({ subOrderId, reasons, maxPhotos }: { subOrderId: string; reasons: [string, string][]; maxPhotos: number }) {
  const [state, action] = useActionState(openDisputeAction, initialFormState)
  const [note, setNote] = useState<string | null>(null)

  /** Shrinks chosen photos in the browser and keeps at most `maxPhotos`. */
  async function onPhotos(input: HTMLInputElement) {
    const files = Array.from(input.files ?? [])
    const kept = files.slice(0, maxPhotos)
    const transfer = new DataTransfer()
    for (const file of kept) {
      try {
        transfer.items.add((await resizeImage(file, 1600)).file)
      } catch {
        transfer.items.add(file)
      }
    }
    input.files = transfer.files
    setNote(files.length > maxPhotos ? `Only the first ${maxPhotos} photos will be sent.` : kept.length ? `${kept.length} photo(s) ready.` : null)
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="subOrderId" value={subOrderId} />
      <SelectField name="reason" label="What's wrong?" options={reasons} placeholder="Choose one" state={state} />
      <TextAreaField name="description" label="Tell us what happened" rows={5} maxLength={2000} state={state} hint="What you expected, what you got, and anything you've already tried with the seller." />
      <div className="grid gap-1.5">
        <label htmlFor="photos" className="text-sm font-medium">
          Photos (optional, up to {maxPhotos})
        </label>
        <input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple onChange={(e) => void onPhotos(e.currentTarget)} className="text-sm" />
        <p className="text-xs text-muted-foreground">{note ?? "Only BestMart's support team can see them."}</p>
      </div>
      <div>
        <SubmitButton pendingText="Sending…">Report the problem</SubmitButton>
      </div>
    </form>
  )
}
