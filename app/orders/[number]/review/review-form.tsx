"use client"

import { useActionState, useState } from "react"
import { Star } from "lucide-react"

import { FormMessage, SubmitButton, TextAreaField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"
import { shrinkFileInput } from "@/lib/client/resize-image"
import { cn } from "@/lib/utils"

import { createReviewAction } from "./actions"

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"]

export function ReviewForm({ orderItemId, orderNumber }: { orderItemId: string; orderNumber: string }) {
  const [state, action] = useActionState(createReviewAction, initialFormState)
  const [rating, setRating] = useState(Number(state.values?.rating ?? 0))
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your rating</legend>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" aria-label={`${n} star${n === 1 ? "" : "s"}`} />
              <Star className={cn("size-8", n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} aria-hidden />
            </label>
          ))}
          <span className="ml-2 text-sm text-muted-foreground">{LABELS[rating]}</span>
        </div>
        {state.fieldErrors?.rating ? <p className="mt-1 text-xs font-medium text-destructive">{state.fieldErrors.rating}</p> : null}
      </fieldset>
      <TextAreaField name="body" label="Your review (optional)" rows={5} maxLength={2000} state={state} hint="What did you like or not? Shoppers read these before buying." />
      <div className="grid gap-1.5">
        <label htmlFor="review-photo" className="text-sm font-medium">
          Photo (optional)
        </label>
        <input id="review-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(e) => void shrinkFileInput(e.currentTarget, 1600)} className="text-sm" />
      </div>
      <div>
        <SubmitButton pendingText="Posting…">Post review</SubmitButton>
      </div>
    </form>
  )
}
