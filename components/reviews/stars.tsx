import { Star } from "lucide-react"

import { cn } from "@/lib/utils"

/** Read-only star rating, e.g. 4.3 → four full stars and a partial fifth. */
export function Stars({ rating, size = "sm", className }: { rating: number; size?: "sm" | "md"; className?: string }) {
  const px = size === "md" ? "size-5" : "size-3.5"
  return (
    <span className={cn("inline-flex items-center", className)} role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - (i - 1)))
        return (
          <span key={i} className={cn("relative", px)} aria-hidden>
            <Star className={cn("absolute inset-0 text-muted-foreground/40", px)} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("fill-amber-400 text-amber-400", px)} />
            </span>
          </span>
        )
      })}
    </span>
  )
}
