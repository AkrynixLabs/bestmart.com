"use client"

import { useActionState, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { FormMessage, SubmitButton } from "@/components/forms/form-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { initialFormState } from "@/lib/actions/state"

import { saveDeliverySettingsAction } from "./actions"

type Row = { upToKm: string; fee: string }

export function DeliverySettingsForm({ initialRows, roadFactorPct }: { initialRows: Row[]; roadFactorPct: number }) {
  const [state, action] = useActionState(saveDeliverySettingsAction, initialFormState)
  const [rows, setRows] = useState<Row[]>(initialRows)
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">From</th>
              <th className="px-3 py-2 font-medium">Up to (km)</th>
              <th className="px-3 py-2 font-medium">Fee (GH₵)</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, i) => {
              const last = i === rows.length - 1
              const from = i === 0 ? "0" : rows[i - 1]?.upToKm || "…"
              return (
                <tr key={i}>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{from} km</td>
                  <td className="px-3 py-2">
                    {last ? (
                      <>
                        <span className="text-muted-foreground">and beyond</span>
                        <input type="hidden" name="upToKm" value="" />
                      </>
                    ) : (
                      <Input name="upToKm" aria-label={`Band ${i + 1} up to km`} value={row.upToKm} inputMode="decimal" onChange={(e) => update(i, { upToKm: e.target.value })} className="h-9 w-24" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input name="fee" aria-label={`Band ${i + 1} fee in cedis`} value={row.fee} inputMode="decimal" onChange={(e) => update(i, { fee: e.target.value })} className="h-9 w-24" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {rows.length > 1 && !last ? (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove band ${i + 1}`} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rows.length >= 20}
          onClick={() => setRows((r) => [...r.slice(0, -1), { upToKm: "", fee: r.at(-1)?.fee ?? "" }, r.at(-1)!])}
        >
          <Plus aria-hidden /> Add a band
        </Button>
      </div>
      <label className="grid max-w-xs gap-1.5 text-sm font-medium">
        Road factor (%)
        <Input name="roadFactorPct" defaultValue={String(roadFactorPct)} inputMode="numeric" className="h-10" />
        <span className="text-xs font-normal text-muted-foreground">Straight-line distance × this ÷ 100 approximates the road route. 130 is typical for city roads.</span>
      </label>
      <div>
        <SubmitButton pendingText="Saving…">Save delivery fees</SubmitButton>
      </div>
    </form>
  )
}
