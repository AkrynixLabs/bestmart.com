import type { Metadata } from "next"
import { randomUUID } from "node:crypto"
import Link from "next/link"
import { redirect } from "next/navigation"
import { MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import { requireUser } from "@/lib/auth/session"
import { getCartView } from "@/lib/cart/cart"
import { deliveryQuoteFor, releaseExpiredReservations } from "@/lib/checkout/orders"
import { describeQuote } from "@/lib/delivery/fee"
import { formatGhs } from "@/lib/money"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { regionLabel } from "@/lib/validation/common"

import { PlaceOrderForm } from "./place-order-form"

export const metadata: Metadata = { title: "Checkout", robots: { index: false } }

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ address?: string }> }) {
  const user = await requireUser("/checkout")
  await releaseExpiredReservations()
  const [cart, addresses, settings, { address: chosen }] = await Promise.all([
    getCartView(),
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    getPlatformSettings(),
    searchParams,
  ])
  if (cart.groups.length === 0) redirect("/cart")
  const address = addresses.find((a) => a.id === chosen) ?? addresses[0] ?? null
  const stores = await prisma.store.findMany({
    where: { id: { in: cart.groups.map((g) => g.store.id) } },
    select: { id: true, region: true, city: true, pickupArea: true, pickupLatitude: true, pickupLongitude: true },
  })
  const storeById = new Map(stores.map((s) => [s.id, s]))
  const parts = cart.groups.map((group) => {
    const store = storeById.get(group.store.id)!
    const quote = address ? deliveryQuoteFor(store, address, settings.deliveryBands, settings.deliveryRoadFactorPct) : null
    return { group, quote }
  })
  const delivery = parts.reduce((s, p) => s + (p.quote?.feePesewas ?? 0), 0)
  const total = cart.subtotal + delivery

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Checkout</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-8">
          <section aria-labelledby="deliver-to">
            <div className="flex items-center justify-between gap-2">
              <h2 id="deliver-to" className="text-lg font-semibold">
                Deliver to
              </h2>
              <Link href="/account/addresses/new?returnTo=/checkout" className="text-sm font-medium text-primary hover:underline">
                Add a new address
              </Link>
            </div>
            {addresses.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed p-6 text-center">
                <p className="font-medium">Add a delivery address to continue.</p>
                <Button asChild className="mt-3">
                  <Link href="/account/addresses/new?returnTo=/checkout">Add address</Link>
                </Button>
              </div>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/checkout?address=${a.id}`}
                      aria-current={a.id === address?.id ? "true" : undefined}
                      className={cn("block h-full rounded-xl border p-3 text-sm hover:bg-muted/50", a.id === address?.id && "border-primary ring-2 ring-primary/20")}
                    >
                      <p className="font-medium">
                        {a.label ? `${a.label} · ` : ""}
                        {a.recipientName}
                      </p>
                      <p className="text-muted-foreground">
                        {a.area}, {a.city}, {regionLabel[a.region]}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" aria-hidden /> {a.latitude !== null ? "Map pin set" : "No map pin (fee estimated)"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="your-items" className="grid gap-4">
            <h2 id="your-items" className="text-lg font-semibold">
              Your items
            </h2>
            {parts.map(({ group, quote }) => (
              <div key={group.store.id} className="rounded-xl border">
                <p className="border-b px-4 py-2.5 text-sm">
                  From <span className="font-semibold">{group.store.name}</span>
                </p>
                <ul className="divide-y text-sm">
                  {group.lines.map((line) => (
                    <li key={line.id} className="flex justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0">
                        {line.quantity} × {line.title}
                        {line.optionValues.length ? <span className="text-muted-foreground"> · {line.optionValues.join(" / ")}</span> : null}
                        {line.problem ? <span className="block font-medium text-destructive">Not available as is: update your cart.</span> : null}
                      </span>
                      <span className="tabular-nums">{formatGhs(line.unitPrice * line.quantity)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3 bg-muted/40 px-4 py-2.5">
                    <span>
                      Delivery
                      {quote ? <span className="block text-xs text-muted-foreground">{describeQuote(quote)}</span> : null}
                    </span>
                    <span className="tabular-nums">{quote ? formatGhs(quote.feePesewas) : "Choose an address"}</span>
                  </li>
                </ul>
              </div>
            ))}
          </section>
        </div>

        <aside className="h-fit rounded-xl border p-4 lg:sticky lg:top-20">
          <h2 className="font-semibold">Order total</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Items</dt>
              <dd className="tabular-nums">{formatGhs(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery ({parts.length} seller{parts.length === 1 ? "" : "s"})</dt>
              <dd className="tabular-nums">{address ? formatGhs(delivery) : "–"}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatGhs(total)}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <PlaceOrderForm addressId={address?.id ?? null} idempotencyKey={randomUUID()} total={formatGhs(total)} disabled={cart.hasProblems} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            We hold your items for {settings.stockReservationMinutes} minutes while you pay. Your payment stays with {"BestMart"} until you confirm delivery.
          </p>
          {cart.hasProblems ? (
            <p className="mt-2 text-sm text-destructive">
              Some items changed. <Link href="/cart" className="underline">Review your cart</Link>.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
