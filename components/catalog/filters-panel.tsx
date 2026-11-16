import Link from "next/link"
import { SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SORTS, type SearchParams } from "@/lib/catalog/filters"
import type { TreeAttribute } from "@/lib/catalog/tree"

import { ResponsiveDetails } from "./responsive-details"

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""
const all = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v])
const inputClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm"

/**
 * Filters as a plain GET form: works without JavaScript, and every filtered
 * view has a shareable URL. Text attributes aren't offered as filters.
 */
export function FiltersPanel({ pathname, params, attributes, showRelevance }: { pathname: string; params: SearchParams; attributes: TreeAttribute[]; showRelevance: boolean }) {
  const filterable = attributes.filter((a) => a.isFilterable && a.type !== "text")
  const activeCount = Object.keys(params).filter((k) => k === "min" || k === "max" || k === "rating" || k.startsWith("a.")).length
  return (
    <ResponsiveDetails className="rounded-xl border lg:border-0 [&>summary]:lg:hidden" defaultOpen={activeCount > 0 ? true : undefined}>
      <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium lg:hidden">
        <SlidersHorizontal className="size-4" aria-hidden /> Sort and filter{activeCount ? ` (${activeCount})` : ""}
      </summary>
      <form action={pathname} className="grid gap-5 p-3 pt-0 lg:p-0">
        {params.q ? <input type="hidden" name="q" value={first(params.q)} /> : null}

        <label className="grid gap-1.5 text-sm font-medium">
          Sort by
          <select name="sort" defaultValue={first(params.sort) || (showRelevance ? "relevance" : "newest")} className={inputClass}>
            {SORTS.filter((s) => showRelevance || s.value !== "relevance").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Price (GH₵)</legend>
          <div className="flex items-center gap-2">
            <input name="min" inputMode="decimal" defaultValue={first(params.min)} placeholder="Min" aria-label="Minimum price" className={inputClass} />
            <span aria-hidden>–</span>
            <input name="max" inputMode="decimal" defaultValue={first(params.max)} placeholder="Max" aria-label="Maximum price" className={inputClass} />
          </div>
        </fieldset>

        <label className="grid gap-1.5 text-sm font-medium">
          Customer rating
          <select name="rating" defaultValue={first(params.rating)} className={inputClass}>
            <option value="">Any</option>
            <option value="4">4 stars and up</option>
            <option value="3">3 stars and up</option>
            <option value="2">2 stars and up</option>
          </select>
        </label>

        {filterable.map((a) => {
          const field = `a.${a.key}`
          if (a.type === "number") {
            return (
              <fieldset key={a.id} className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">
                  {a.name}
                  {a.unit ? ` (${a.unit})` : ""}
                </legend>
                <div className="flex items-center gap-2">
                  <input name={`${field}.min`} inputMode="decimal" defaultValue={first(params[`${field}.min`])} placeholder="Min" aria-label={`Minimum ${a.name}`} className={inputClass} />
                  <span aria-hidden>–</span>
                  <input name={`${field}.max`} inputMode="decimal" defaultValue={first(params[`${field}.max`])} placeholder="Max" aria-label={`Maximum ${a.name}`} className={inputClass} />
                </div>
              </fieldset>
            )
          }
          if (a.type === "boolean") {
            return (
              <label key={a.id} className="grid gap-1.5 text-sm font-medium">
                {a.name}
                <select name={field} defaultValue={first(params[field])} className={inputClass}>
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            )
          }
          const selected = all(params[field])
          return (
            <fieldset key={a.id} className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">{a.name}</legend>
              <div className="grid max-h-56 gap-1.5 overflow-y-auto pr-1">
                {a.options.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={field} value={option} defaultChecked={selected.includes(option)} className="size-4 accent-[var(--brand-blue)]" />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          )
        })}

        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Apply
          </Button>
          {activeCount > 0 || params.sort ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={params.q ? `${pathname}?q=${encodeURIComponent(first(params.q))}` : pathname}>Clear</Link>
            </Button>
          ) : null}
        </div>
      </form>
    </ResponsiveDetails>
  )
}
