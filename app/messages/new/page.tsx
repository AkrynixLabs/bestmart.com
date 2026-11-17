import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { Compose } from "@/components/messages/compose"
import { requireUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

import { sendBuyerMessageAction } from "../actions"

export const metadata: Metadata = { title: "Message the seller", robots: { index: false } }

type Search = { store?: string; product?: string; order?: string }

export default async function NewMessagePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { store: storeSlug, product: productSlug, order: orderNumber } = await searchParams
  const query = new URLSearchParams(Object.entries({ store: storeSlug, product: productSlug, order: orderNumber }).filter((e): e is [string, string] => Boolean(e[1])))
  const user = await requireUser(`/messages/new?${query}`)
  if (!storeSlug) notFound()
  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true, name: true, status: true, userId: true } })
  if (!store || store.status !== "active") notFound()
  if (store.userId === user.id) redirect("/seller/messages")
  const product = productSlug ? await prisma.product.findFirst({ where: { slug: productSlug, storeId: store.id }, select: { id: true, title: true } }) : null
  const order = orderNumber ? await prisma.order.findFirst({ where: { number: orderNumber, userId: user.id, subOrders: { some: { storeId: store.id } } }, select: { number: true } }) : null
  const existing = await prisma.conversation.findUnique({ where: { storeId_buyerId: { storeId: store.id, buyerId: user.id } }, select: { id: true } })
  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Message {store.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {product ? `About: ${product.title}. ` : order ? `About order ${order.number}. ` : ""}
          {existing ? "This adds to your conversation with this store." : "Ask about sizes, stock, delivery or anything else."}
        </p>
      </div>
      <Compose
        action={sendBuyerMessageAction}
        hidden={{ storeId: store.id, fromNew: "1", ...(product ? { productId: product.id } : {}), ...(order ? { orderNumber: order.number } : {}) }}
        label="Your message"
      />
    </div>
  )
}
