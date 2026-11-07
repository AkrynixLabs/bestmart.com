"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShoppingCart } from "lucide-react"

export const CART_CHANGED = "bestmart:cart-changed"

/** Header cart icon with a live count. Client-side so pages can stay static. */
export function CartLink() {
  const [count, setCount] = useState<number | null>(null)
  const pathname = usePathname()
  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch("/api/cart", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((d: { count: number }) => !cancelled && setCount(d.count))
        .catch(() => {})
    load()
    window.addEventListener(CART_CHANGED, load)
    return () => {
      cancelled = true
      window.removeEventListener(CART_CHANGED, load)
    }
  }, [pathname])
  return (
    <Link href="/cart" className="relative inline-flex rounded-md p-2 hover:bg-muted" aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}>
      <ShoppingCart className="size-5" aria-hidden />
      {count ? (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-brand-orange px-1 text-[11px] font-bold leading-5 text-white" aria-hidden>
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  )
}
