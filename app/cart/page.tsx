import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ImageOff, ShoppingCart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getCartView } from "@/lib/cart/cart"
import { problemText } from "@/lib/cart/rules"
import { releaseExpiredReservations } from "@/lib/checkout/orders"
import { formatGhs } from "@/lib/money"

import { CartQuantity } from "./cart-quantity"

export const metadata: Metadata = { title: "Your cart", robots: { index: false } }

export default async function CartPage() {
  await releaseExpiredReservations()
  const cart = await getCartView()

  if (cart.groups.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
        <ShoppingCart className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Find something you like and add it here.</p>
        <Button asChild className="mt-6">
          <Link href="/">Start shopping</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your cart</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-6">
          {cart.groups.map((group) => (
            <section key={group.store.id} aria-label={`From ${group.store.name}`} className="rounded-xl border">
              <header className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm">
                <p>
                  From{" "}
                  <Link href={`/s/${group.store.slug}`} className="font-semibold hover:underline">
                    {group.store.name}
                  </Link>
                </p>
                <p className="text-muted-foreground">Delivery worked out at checkout</p>
              </header>
              <ul className="divide-y">
                {group.lines.map((line) => (
                  <li key={line.id} className="flex gap-3 p-4">
                    <Link href={`/p/${line.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {line.imageUrl ? (
                        <Image src={line.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                      ) : (
                        <ImageOff className="m-auto mt-7 size-5 text-muted-foreground" aria-hidden />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/p/${line.slug}`} className="line-clamp-2 font-medium hover:underline">
                        {line.title}
                      </Link>
                      {line.optionValues.length ? <p className="text-sm text-muted-foreground">{line.optionValues.join(" / ")}</p> : null}
                      <p className="mt-1 text-sm">{formatGhs(line.unitPrice)} each</p>
                      {line.problem ? (
                        <p className="mt-1 text-sm font-medium text-destructive">
                          {problemText[line.problem]}
                          {line.problem === "not_enough_stock" ? ` (${line.stock} left)` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                      <p className="font-semibold tabular-nums">{formatGhs(line.unitPrice * line.quantity)}</p>
                      <CartQuantity lineId={line.id} quantity={line.quantity} max={line.problem === "unavailable" || line.problem === "out_of_stock" ? 0 : line.maxQuantity} label={line.title} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="h-fit rounded-xl border p-4 lg:sticky lg:top-20">
          <h2 className="font-semibold">Summary</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Items</dt>
              <dd className="tabular-nums">{formatGhs(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd>At checkout</dd>
            </div>
          </dl>
          {cart.hasProblems ? <p className="mt-3 text-sm text-destructive">Fix or remove the highlighted items to check out.</p> : null}
          {cart.hasProblems ? (
            <Button className="mt-4 w-full" size="lg" disabled>
              Check out
            </Button>
          ) : (
            <Button asChild className="mt-4 w-full" size="lg">
              <Link href="/checkout">Check out</Link>
            </Button>
          )}
          <p className="mt-3 text-xs text-muted-foreground">You&apos;ll sign in (or create an account) to check out. Your cart comes with you.</p>
        </aside>
      </div>
    </div>
  )
}
