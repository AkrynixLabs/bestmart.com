"use client"

import { useActionState, useMemo, useState } from "react"
import { Plus, RefreshCw, Trash2 } from "lucide-react"

import { FormMessage, SubmitButton } from "@/components/forms/form-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { initialFormState, type FormState } from "@/lib/actions/state"
import { combinations, suggestSku, type ProductOption } from "@/lib/catalog/product-rules"
import { cn } from "@/lib/utils"
import { MAX_OPTIONS, MAX_VARIANTS, splitList } from "@/lib/validation/catalog"

import { saveVariantsAction } from "../actions"

type Row = { id?: string; sku: string; optionValues: string[]; price: string; compareAtPrice: string; stock: string; isActive: boolean }
type OptionDraft = { name: string; values: string }

const comboKey = (values: string[]) => JSON.stringify(values)

type EditorProps = {
  productId: string
  title: string
  lowStockThreshold: number
  initialOptions: ProductOption[]
  initialVariants: Row[]
}

/**
 * The save result lives here, outside the keyed editor: after a save the
 * editor remounts (so new rows pick up their database ids) without losing
 * the "Variants saved." message.
 */
export function VariantsEditor({ version, ...props }: EditorProps & { version: string }) {
  const [state, action] = useActionState(saveVariantsAction, initialFormState)
  return <Editor key={version} state={state} action={action} {...props} />
}

function Editor({
  productId,
  title,
  lowStockThreshold,
  initialOptions,
  initialVariants,
  state,
  action,
}: EditorProps & { state: FormState; action: (formData: FormData) => void }) {
  const [options, setOptions] = useState<OptionDraft[]>(initialOptions.map((o) => ({ name: o.name, values: o.values.join(", ") })))
  const [rows, setRows] = useState<Row[]>(
    initialVariants.length > 0 ? initialVariants : [{ sku: suggestSku(title, []), optionValues: [], price: "", compareAtPrice: "", stock: "0", isActive: true }],
  )
  const [bulkPrice, setBulkPrice] = useState("")

  const parsedOptions: ProductOption[] = useMemo(
    () => options.map((o) => ({ name: o.name.trim(), values: splitList(o.values) })).filter((o) => o.name && o.values.length > 0),
    [options],
  )
  const expected = useMemo(() => combinations(parsedOptions), [parsedOptions])
  const outOfSync = expected.length !== rows.length || expected.some((combo, i) => comboKey(combo) !== comboKey(rows[i]?.optionValues ?? []))
  const tooMany = expected.length > MAX_VARIANTS

  /** Rebuild rows for the current options, keeping prices/stock of combinations that still exist. */
  function regenerate() {
    if (tooMany) return
    const existing = new Map(rows.map((r) => [comboKey(r.optionValues), r]))
    const template = rows[0]
    setRows(
      expected.map(
        (combo) =>
          existing.get(comboKey(combo)) ?? {
            sku: suggestSku(title, combo),
            optionValues: combo,
            price: template?.price ?? "",
            compareAtPrice: template?.compareAtPrice ?? "",
            stock: "0",
            isActive: true,
          },
      ),
    )
  }

  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const payload = JSON.stringify({
    options: parsedOptions,
    variants: rows.map((r) => ({ id: r.id, sku: r.sku, optionValues: r.optionValues, price: r.price, compareAtPrice: r.compareAtPrice, stock: r.stock, isActive: r.isActive })),
  })

  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="payload" value={payload} />

      <div className="grid gap-3 rounded-xl border p-4">
        <p className="text-sm font-medium">Options</p>
        {options.length === 0 ? <p className="text-sm text-muted-foreground">No options: the product is sold as one version.</p> : null}
        {options.map((option, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-end">
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Option name</span>
              <Input value={option.name} maxLength={30} placeholder="Size" onChange={(e) => setOptions((o) => o.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Values, separated by commas</span>
              <Input value={option.values} placeholder="S, M, L, XL" onChange={(e) => setOptions((o) => o.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} />
            </label>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove option ${option.name || i + 1}`} onClick={() => setOptions((o) => o.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {options.length < MAX_OPTIONS ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setOptions((o) => [...o, { name: "", values: "" }])}>
              <Plus aria-hidden /> Add an option
            </Button>
          ) : null}
          {outOfSync ? (
            <Button type="button" size="sm" onClick={regenerate} disabled={tooMany}>
              <RefreshCw aria-hidden /> Update variants ({expected.length})
            </Button>
          ) : null}
        </div>
        {tooMany ? <p className="text-sm text-destructive">That makes {expected.length} combinations; the limit is {MAX_VARIANTS}. Remove some values.</p> : null}
        {outOfSync && !tooMany ? <p className="text-sm text-brand-orange-dark">The options changed. Click &ldquo;Update variants&rdquo; before saving.</p> : null}
      </div>

      {rows.length > 1 ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Same price for all (GH₵)</span>
            <Input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} inputMode="decimal" className="w-36" placeholder="0.00" />
          </label>
          <Button type="button" variant="outline" size="sm" disabled={!bulkPrice.trim()} onClick={() => setRows((r) => r.map((x) => ({ ...x, price: bulkPrice.trim() })))}>
            Apply to all
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {parsedOptions.length > 0 ? <th className="px-3 py-2 font-medium">Variant</th> : null}
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Price (GH₵)</th>
              <th className="px-3 py-2 font-medium">Was-price (optional)</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Selling</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, i) => {
              const label = row.optionValues.join(" / ") || "Default"
              const stock = Number(row.stock)
              const low = row.isActive && Number.isFinite(stock) && stock <= lowStockThreshold
              return (
                <tr key={comboKey(row.optionValues) + (row.id ?? "")} className={row.isActive ? "" : "opacity-60"}>
                  {parsedOptions.length > 0 ? <td className="px-3 py-2 font-medium">{label}</td> : null}
                  <td className="px-3 py-2">
                    <Input aria-label={`SKU for ${label}`} value={row.sku} maxLength={64} onChange={(e) => update(i, { sku: e.target.value })} className="h-9 w-44" />
                  </td>
                  <td className="px-3 py-2">
                    <Input aria-label={`Price for ${label}`} value={row.price} inputMode="decimal" placeholder="0.00" onChange={(e) => update(i, { price: e.target.value })} className="h-9 w-28" />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      aria-label={`Was-price for ${label}`}
                      value={row.compareAtPrice}
                      inputMode="decimal"
                      onChange={(e) => update(i, { compareAtPrice: e.target.value })}
                      className="h-9 w-28"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Input aria-label={`Stock for ${label}`} value={row.stock} inputMode="numeric" onChange={(e) => update(i, { stock: e.target.value })} className="h-9 w-20" />
                      {low ? <span className={cn("text-xs font-medium", stock === 0 ? "text-destructive" : "text-brand-orange-dark")}>{stock === 0 ? "Sold out" : "Low"}</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Sell ${label}`}
                      checked={row.isActive}
                      onChange={(e) => update(i, { isActive: e.target.checked })}
                      className="size-4 accent-[var(--brand-blue)]"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div>
        <SubmitButton disabled={outOfSync || tooMany} pendingText="Saving…">
          Save prices and stock
        </SubmitButton>
      </div>
    </form>
  )
}
