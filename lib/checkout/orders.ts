import "server-only"
import { randomBytes } from "node:crypto"

import { orderNumber } from "@/lib/cart/rules"
import { getCategoryTree } from "@/lib/catalog/categories"
import { syncProductAggregates } from "@/lib/catalog/products"
import { effectiveCommissionBps, isVisible } from "@/lib/catalog/tree"
import { quoteDelivery, readBands, type DeliveryQuote } from "@/lib/delivery/fee"
import { Prisma } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

// Checkout is one transaction: lock the variant rows, re-check everything
// against the database (prices, stock, availability), work out delivery per
// seller, write the order, and reserve stock by decrementing it. Nothing is
// trusted from the browser except which address and the idempotency key.

export class CheckoutError extends Error {}

type AddressLike = {
  recipientName: string
  phone: string
  region: Prisma.AddressGetPayload<object>["region"]
  city: string
  area: string
  streetAddress: string | null
  landmark: string | null
  gpsAddress: string | null
  latitude: number | null
  longitude: number | null
}

type StoreLike = { region: AddressLike["region"]; city: string; pickupArea: string | null; pickupLatitude: number | null; pickupLongitude: number | null }

/** The delivery quote from a store's pickup point to an address. */
export function deliveryQuoteFor(store: StoreLike, address: AddressLike, bands: unknown, roadFactorPct: number): DeliveryQuote {
  return quoteDelivery(
    { latitude: store.pickupLatitude, longitude: store.pickupLongitude, area: store.pickupArea, city: store.city, region: store.region },
    { latitude: address.latitude, longitude: address.longitude, area: address.area, city: address.city, region: address.region },
    readBands(bands),
    roadFactorPct,
  )
}

export async function placeOrder({ userId, addressId, idempotencyKey }: { userId: string; addressId: string; idempotencyKey: string }) {
  const previous = await prisma.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } }, select: { id: true, number: true } })
  if (previous) return previous

  await releaseExpiredReservations()

  const [address, cart, settings, tree] = await Promise.all([
    prisma.address.findFirst({ where: { id: addressId, userId } }),
    prisma.cart.findUnique({ where: { userId }, include: { items: true } }),
    getPlatformSettings(),
    getCategoryTree(),
  ])
  if (!address) throw new CheckoutError("Choose a delivery address.")
  if (!cart || cart.items.length === 0) throw new CheckoutError("Your cart is empty.")
  const quantities = new Map(cart.items.map((i) => [i.variantId, i.quantity]))
  const variantIds = [...quantities.keys()].sort()

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Lock in a fixed order (by id) so two checkouts can't deadlock.
        const locked = await tx.$queryRaw<{ id: string; stock: number }[]>`
          SELECT "id", "stock" FROM "product_variants" WHERE "id" = ANY(${variantIds}::text[]) ORDER BY "id" FOR UPDATE`
        const stockById = new Map(locked.map((v) => [v.id, v.stock]))
        const variants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                status: true,
                blockedAt: true,
                categoryId: true,
                images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
                store: { select: { id: true, userId: true, status: true, region: true, city: true, pickupArea: true, pickupLatitude: true, pickupLongitude: true } },
              },
            },
          },
        })

        const problems: string[] = []
        if (variants.length !== variantIds.length) problems.push("Something in your cart no longer exists.")
        for (const v of variants) {
          const p = v.product
          const qty = quantities.get(v.id)!
          const stock = stockById.get(v.id) ?? 0
          if (p.store.userId === userId) problems.push(`"${p.title}" is from your own store; you can't buy it.`)
          else if (!v.isActive || p.status !== "active" || p.blockedAt || p.store.status !== "active" || !isVisible(tree, p.categoryId)) problems.push(`"${p.title}" is no longer available.`)
          else if (qty > stock) problems.push(stock === 0 ? `"${p.title}" just sold out.` : `Only ${stock} of "${p.title}" left.`)
        }
        if (problems.length > 0) throw new CheckoutError(`${problems.join(" ")} Please review your cart.`)

        // Group by seller and price each part.
        const byStore = new Map<string, typeof variants>()
        for (const v of variants) byStore.set(v.product.store.id, [...(byStore.get(v.product.store.id) ?? []), v])
        const parts = [...byStore.values()].map((lines) => {
          const store = lines[0]!.product.store
          const itemsTotal = lines.reduce((sum, v) => sum + v.price * quantities.get(v.id)!, 0)
          return { store, lines, itemsTotal, quote: deliveryQuoteFor(store, address, settings.deliveryBands, settings.deliveryRoadFactorPct) }
        })
        const itemsTotal = parts.reduce((s, p) => s + p.itemsTotal, 0)
        const deliveryTotal = parts.reduce((s, p) => s + p.quote.feePesewas, 0)

        const order = await tx.order.create({
          data: {
            number: orderNumber(new Date(), (n) => randomBytes(n)),
            userId,
            idempotencyKey,
            itemsTotal,
            deliveryTotal,
            grandTotal: itemsTotal + deliveryTotal,
            reservedUntil: new Date(Date.now() + settings.stockReservationMinutes * 60_000),
            recipientName: address.recipientName,
            phone: address.phone,
            region: address.region,
            city: address.city,
            area: address.area,
            streetAddress: address.streetAddress,
            landmark: address.landmark,
            gpsAddress: address.gpsAddress,
            latitude: address.latitude,
            longitude: address.longitude,
          },
        })
        for (const part of parts) {
          const sub = await tx.subOrder.create({
            data: { orderId: order.id, storeId: part.store.id, itemsTotal: part.itemsTotal, deliveryFee: part.quote.feePesewas, deliveryKm: part.quote.km, distanceSource: part.quote.source },
          })
          await tx.orderItem.createMany({
            data: part.lines.map((v) => {
              const quantity = quantities.get(v.id)!
              return {
                subOrderId: sub.id,
                productId: v.product.id,
                variantId: v.id,
                title: v.product.title,
                optionValues: v.optionValues,
                sku: v.sku,
                imageUrl: v.product.images[0]?.url ?? null,
                unitPrice: v.price,
                quantity,
                lineTotal: v.price * quantity,
                commissionBps: effectiveCommissionBps(tree, v.product.categoryId, settings.commissionBps),
              }
            }),
          })
        }
        // Reserve: take the stock now; it's given back if the order expires or is cancelled.
        for (const v of variants) {
          await tx.productVariant.update({ where: { id: v.id }, data: { stock: { decrement: quantities.get(v.id)! } } })
        }
        for (const productId of new Set(variants.map((v) => v.product.id))) await syncProductAggregates(tx, productId)
        await tx.cartItem.deleteMany({ where: { cartId: cart.id, variantId: { in: variantIds } } })
        return { id: order.id, number: order.number }
      })
    } catch (error) {
      // An order-number collision (vanishingly rare) is retried; the same idempotency key means the first attempt won.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } }, select: { id: true, number: true } })
        if (existing) return existing
        continue
      }
      throw error
    }
  }
  throw new CheckoutError("We couldn't place your order. Please try again.")
}

/** Gives back reserved stock for one order and moves it (and its parts) to the final status. */
async function releaseOrder(orderId: string, to: "expired" | "cancelled", onlyIfExpired: boolean): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Claim it first, so a release and a payment (Phase 4) can't both win.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "awaiting_payment", ...(onlyIfExpired ? { reservedUntil: { lt: new Date() } } : {}) },
      data: { status: to, ...(to === "cancelled" ? { cancelledAt: new Date() } : {}) },
    })
    if (claimed.count !== 1) return false
    await tx.subOrder.updateMany({ where: { orderId }, data: { status: to } })
    const items = await tx.orderItem.findMany({ where: { subOrder: { orderId }, variantId: { not: null } }, select: { variantId: true, productId: true, quantity: true } })
    for (const item of items) await tx.productVariant.updateMany({ where: { id: item.variantId! }, data: { stock: { increment: item.quantity } } })
    for (const productId of new Set(items.flatMap((i) => (i.productId ? [i.productId] : [])))) await syncProductAggregates(tx, productId)
    return true
  })
}

/**
 * Expires unpaid orders past their reservation and returns their stock.
 * Runs before every checkout, when carts and orders are viewed, and from
 * the cron route as a backstop.
 */
export async function releaseExpiredReservations(limit = 100): Promise<number> {
  const due = await prisma.order.findMany({ where: { status: "awaiting_payment", reservedUntil: { lt: new Date() } }, select: { id: true }, orderBy: { reservedUntil: "asc" }, take: limit })
  let released = 0
  for (const { id } of due) {
    try {
      if (await releaseOrder(id, "expired", true)) released++
    } catch (error) {
      logger.error("reservation release failed", { orderId: id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  if (released > 0) logger.info("expired unpaid orders", { released })
  return released
}

/** A shopper cancelling their own unpaid order. */
export async function cancelOrder(userId: string, orderId: string): Promise<boolean> {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, select: { id: true } })
  if (!order) return false
  return releaseOrder(order.id, "cancelled", false)
}
