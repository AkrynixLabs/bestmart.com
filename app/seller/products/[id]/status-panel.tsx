"use client"

import { useActionState } from "react"
import { CheckCircle2, CircleAlert, ShieldAlert } from "lucide-react"

import { FormMessage, SubmitButton } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { setProductStatusAction } from "../actions"

export function StatusPanel({
  productId,
  status,
  blockedReason,
  problems,
}: {
  productId: string
  status: "draft" | "active" | "archived"
  blockedReason: string | null
  problems: string[]
}) {
  const [state, action] = useActionState(setProductStatusAction, initialFormState)
  const ready = problems.length === 0
  return (
    <section aria-label="Publishing" className="grid gap-4 rounded-xl border bg-card p-4">
      <FormMessage state={state} />
      {blockedReason ? (
        <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong>Blocked by BestMart.</strong> Shoppers can&apos;t see this listing. Reason: {blockedReason}
          </p>
        </div>
      ) : null}

      {status !== "active" && status !== "archived" ? (
        ready ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" aria-hidden /> Ready to publish.
          </p>
        ) : (
          <div className="text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CircleAlert className="size-4 text-brand-orange-dark" aria-hidden /> Before you can publish:
            </p>
            <ul className="mt-2 list-disc pl-10 text-muted-foreground">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )
      ) : status === "active" ? (
        <p className="text-sm text-muted-foreground">{blockedReason ? "Published, but hidden while blocked." : "Live: shoppers can find and view this product."}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Archived: hidden from shoppers and from your main product list.</p>
      )}

      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="productId" value={productId} />
        {status === "draft" ? (
          <SubmitButton name="intent" value="publish" disabled={!ready || Boolean(blockedReason)} pendingText="Publishing…">
            Publish
          </SubmitButton>
        ) : null}
        {status === "active" ? (
          <SubmitButton name="intent" value="unpublish" variant="outline" pendingText="Saving…">
            Unpublish
          </SubmitButton>
        ) : null}
        {status !== "archived" ? (
          <SubmitButton name="intent" value="archive" variant="ghost" pendingText="Saving…">
            Archive
          </SubmitButton>
        ) : (
          <SubmitButton name="intent" value="restore" variant="outline" pendingText="Saving…">
            Restore to drafts
          </SubmitButton>
        )}
      </form>
    </section>
  )
}
