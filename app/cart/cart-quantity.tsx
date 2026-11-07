"use client"

import { useTransition } from "react"
import { Loader2, Trash2 } from "lucide-react"

import { CART_CHANGED } from "@/components/layout/cart-link"

import { removeCartLineAction, updateCartLineAction } from "./actions"

/** Quantity select + remove button for one cart line. */
export function CartQuantity({ lineId, quantity, max, label }: { lineId: string; quantity: number; max: number; label: string }) {
  const [pending, startTransition] = useTransition()
  const run = (action: (fd: FormData) => Promise<void>, fields: Record<string, string>) => {
    const form = new FormData()
    form.set("lineId", lineId)
    for (const [k, v] of Object.entries(fields)) form.set(k, v)
    startTransition(async () => {
      await action(form)
      window.dispatchEvent(new Event(CART_CHANGED))
    })
  }
  const options = Array.from({ length: Math.max(max, Math.min(quantity, 20)) }, (_, i) => i + 1)
  return (
    <div className="flex items-center gap-1">
      {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
      {max > 0 ? (
        <select
          aria-label={`Quantity of ${label}`}
          value={quantity}
          disabled={pending}
          onChange={(e) => run(updateCartLineAction, { quantity: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(removeCartLineAction, {})}
        aria-label={`Remove ${label}`}
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}
