"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, ShoppingCart } from "lucide-react"

import { addToCartAction } from "@/app/cart/actions"
import { CART_CHANGED } from "@/components/layout/cart-link"

import { Button } from "@/components/ui/button"
import { formatGhs } from "@/lib/money"
import { cn } from "@/lib/utils"

type Variant = { id: string; optionValues: string[]; price: number; compareAtPrice: number | null; stock: number }
type Option = { name: string; values: string[] }

/** Option buttons (Size, Colour, ...) that pick a variant and show its price and stock. */
export function VariantPicker({ options, variants, lowStockThreshold }: { options: Option[]; variants: Variant[]; lowStockThreshold: number }) {
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0]
  const [selected, setSelected] = useState<string[]>(firstAvailable?.optionValues ?? [])
  const variant = useMemo(() => variants.find((v) => v.optionValues.every((value, i) => value === selected[i])), [variants, selected])

  /** Whether choosing `value` for option `index` (keeping the others) leads to a sellable variant. */
  const available = (index: number, value: string) =>
    variants.some((v) => v.optionValues[index] === value && v.stock > 0 && v.optionValues.every((x, i) => i === index || x === selected[i]))

  const [quantity, setQuantity] = useState(1)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const maxQty = variant ? Math.max(1, Math.min(20, variant.stock)) : 1

  function add() {
    if (!variant) return
    setResult(null)
    startTransition(async () => {
      const res = await addToCartAction(variant.id, Math.min(quantity, maxQty))
      setResult(res)
      if (res.ok) window.dispatchEvent(new Event(CART_CHANGED))
    })
  }

  const onSale = variant?.compareAtPrice !== null && variant?.compareAtPrice !== undefined && variant.compareAtPrice > variant.price
  return (
    <div className="grid gap-5">
      <div>
        {variant ? (
          <p className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-extrabold">{formatGhs(variant.price)}</span>
            {onSale ? <span className="text-muted-foreground line-through">{formatGhs(variant.compareAtPrice!)}</span> : null}
            {onSale ? <span className="rounded bg-brand-orange px-2 py-0.5 text-xs font-semibold text-white">Save {formatGhs(variant.compareAtPrice! - variant.price)}</span> : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">This combination isn&apos;t available.</p>
        )}
        {variant ? (
          <p className={cn("mt-1 text-sm font-medium", variant.stock === 0 ? "text-destructive" : variant.stock <= lowStockThreshold ? "text-brand-orange-dark" : "text-emerald-700")} aria-live="polite">
            {variant.stock === 0 ? "Sold out" : variant.stock <= lowStockThreshold ? `Only ${variant.stock} left` : "In stock"}
          </p>
        ) : null}
      </div>

      {options.map((option, index) => (
        <fieldset key={option.name}>
          <legend className="mb-2 text-sm font-medium">
            {option.name}: <span className="font-normal text-muted-foreground">{selected[index]}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const isSelected = selected[index] === value
              const ok = available(index, value)
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelected((s) => s.map((x, i) => (i === index ? value : x)))}
                  className={cn(
                    "min-w-11 rounded-md border px-3 py-2 text-sm transition-colors",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    !ok && !isSelected && "text-muted-foreground line-through decoration-1",
                  )}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}

      <div className="grid gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Quantity
            <select
              value={Math.min(quantity, maxQty)}
              onChange={(e) => setQuantity(Number(e.target.value))}
              disabled={!variant || variant.stock === 0}
              className="h-11 w-20 rounded-md border border-input bg-background px-2"
            >
              {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button size="lg" variant="accent" className="flex-1 sm:flex-none" disabled={!variant || variant.stock === 0 || pending} onClick={add}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ShoppingCart aria-hidden />} Add to cart
          </Button>
        </div>
        <div aria-live="polite" className="min-h-5 text-sm">
          {result?.ok ? (
            <p className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden /> Added to your cart.{" "}
              <Link href="/cart" className="font-semibold underline">
                View cart
              </Link>
            </p>
          ) : result?.error ? (
            <p role="alert" className="text-destructive">
              {result.error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Pay with MoMo or card. Your money is held until you confirm delivery.</p>
          )}
        </div>
      </div>
    </div>
  )
}
