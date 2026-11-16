"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Heart } from "lucide-react"

import { toggleSavedAction } from "@/app/saved/actions"
import { cn } from "@/lib/utils"

/** Heart toggle for the saved list; signed-out visitors are sent to sign in first. */
export function SaveButton({ productId, initiallySaved, signedIn, returnTo }: { productId: string; initiallySaved: boolean; signedIn: boolean; returnTo: string }) {
  const [saved, setSaved] = useState(initiallySaved)
  const [pending, startTransition] = useTransition()
  const className = "inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"
  if (!signedIn) {
    return (
      <Link href={`/login?callbackUrl=${encodeURIComponent(returnTo)}`} className={className}>
        <Heart className="size-4" aria-hidden /> Save
      </Link>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await toggleSavedAction(productId)
          if (res.ok && res.saved !== undefined) setSaved(res.saved)
        })
      }
      className={className}
    >
      <Heart className={cn("size-4", saved && "fill-brand-orange text-brand-orange")} aria-hidden /> {saved ? "Saved" : "Save"}
    </button>
  )
}
