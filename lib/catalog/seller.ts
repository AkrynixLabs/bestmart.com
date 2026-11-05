import "server-only"
import { cache } from "react"
import { notFound } from "next/navigation"

import { actionUser, requireRole } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

const storeSelect = { id: true, name: true, slug: true, status: true, city: true, region: true, payoutProvider: true, payoutAccountNumber: true } as const

const storeFor = cache(async (userId: string) => prisma.store.findUnique({ where: { userId }, select: storeSelect }))

/** For seller pages: the signed-in seller and their store (404 otherwise). */
export async function requireSellerStore(returnTo: string) {
  const user = await requireRole(["seller"], returnTo)
  const store = await storeFor(user.id)
  if (!store) notFound()
  return { user, store }
}

/**
 * For seller Server Actions. A suspended store can't change its catalog.
 * Returns null when not allowed (callers return an { error }).
 */
export async function actionSellerStore() {
  const user = await actionUser(["seller"])
  if (!user) return null
  const store = await storeFor(user.id)
  if (!store || store.status !== "active") return null
  return { user, store }
}

/** A product that belongs to this store, or null (never reveals other stores' products). */
export async function ownedProduct(storeId: string, productId: string) {
  if (!productId) return null
  return prisma.product.findFirst({ where: { id: productId, storeId } })
}
