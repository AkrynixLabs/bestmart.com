import "server-only"
import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"

import { getCurrentUser } from "@/lib/auth/session"
import { getCategoryTree } from "@/lib/catalog/categories"
import { isVisible } from "@/lib/catalog/tree"
import { isProduction } from "@/lib/env"
import { prisma } from "@/lib/prisma"

import { lineProblem, MAX_LINE_QUANTITY, mergeQuantities, type LineProblem } from "./rules"

// Carts: one per signed-in user, or a guest cart found by a random cookie
// token. When someone with a guest cart is signed in, the guest cart is
// merged into theirs (database only, so it also works while rendering).

export const GUEST_CART_COOKIE = "bm_cart"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

async function guestToken(): Promise<string | undefined> {
  const value = (await cookies()).get(GUEST_CART_COOKIE)?.value
  return value && /^[A-Za-z0-9_-]{20,64}$/.test(value) ? value : undefined
}

/**
 * Moves a guest cart's lines into the user's cart and deletes the guest cart.
 * The guest cart row is locked first: right after sign-in, several requests
 * (the page, the header's cart count) can try to merge at once, and only the
 * first may do it; the others wait, then find nothing left to merge.
 */
async function mergeGuestCart(userId: string, token: string) {
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "carts" WHERE "guestToken" = ${token} FOR UPDATE`
    const guestId = locked[0]?.id
    if (!guestId) return
    const guestItems = await tx.cartItem.findMany({ where: { cartId: guestId } })
    // No relation reads in the upsert, so Prisma uses an atomic INSERT ... ON CONFLICT.
    const cart = await tx.cart.upsert({ where: { userId }, update: {}, create: { userId } })
    const existing = await tx.cartItem.findMany({ where: { cartId: cart.id } })
    const merged = mergeQuantities(new Map(existing.map((i) => [i.variantId, i.quantity])), new Map(guestItems.map((i) => [i.variantId, i.quantity])))
    for (const [variantId, quantity] of merged) {
      await tx.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId } }, update: { quantity }, create: { cartId: cart.id, variantId, quantity } })
    }
    await tx.cart.deleteMany({ where: { id: guestId } })
  })
}

/** The current visitor's cart id, if they have one (merging a leftover guest cart after sign-in). */
export async function currentCartId(): Promise<string | null> {
  const [user, token] = await Promise.all([getCurrentUser(), guestToken()])
  if (user) {
    if (token) await mergeGuestCart(user.id, token)
    return (await prisma.cart.findUnique({ where: { userId: user.id }, select: { id: true } }))?.id ?? null
  }
  if (!token) return null
  return (await prisma.cart.findUnique({ where: { guestToken: token }, select: { id: true } }))?.id ?? null
}

/** For Server Actions: the visitor's cart, created (with its cookie, for guests) if needed. */
export async function ensureCart(): Promise<string> {
  const existing = await currentCartId()
  if (existing) return existing
  const user = await getCurrentUser()
  if (user) return (await prisma.cart.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })).id
  const token = randomBytes(24).toString("base64url")
  const cart = await prisma.cart.create({ data: { guestToken: token } })
  ;(await cookies()).set(GUEST_CART_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/", maxAge: COOKIE_MAX_AGE })
  return cart.id
}

export type CartLine = {
  id: string
  variantId: string
  quantity: number
  title: string
  slug: string
  optionValues: string[]
  imageUrl: string | null
  unitPrice: number
  stock: number
  problem: LineProblem | null
  maxQuantity: number
}

export type CartGroup = { store: { id: string; name: string; slug: string }; lines: CartLine[]; subtotal: number }

export type CartView = { cartId: string | null; groups: CartGroup[]; count: number; subtotal: number; hasProblems: boolean }

const EMPTY: CartView = { cartId: null, groups: [], count: 0, subtotal: 0, hasProblems: false }

/** The cart with live prices, stock and availability, grouped by seller. */
export async function getCartView(cartId?: string | null): Promise<CartView> {
  const id = cartId === undefined ? await currentCartId() : cartId
  if (!id) return EMPTY
  const [items, tree] = await Promise.all([
    prisma.cartItem.findMany({
      where: { cartId: id },
      orderBy: { createdAt: "asc" },
      include: {
        variant: {
          include: {
            product: {
              select: {
                title: true,
                slug: true,
                status: true,
                blockedAt: true,
                categoryId: true,
                store: { select: { id: true, name: true, slug: true, status: true } },
                images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
              },
            },
          },
        },
      },
    }),
    getCategoryTree(),
  ])

  const groups = new Map<string, CartGroup>()
  for (const item of items) {
    const { variant } = item
    const product = variant.product
    const purchasable = variant.isActive && product.status === "active" && !product.blockedAt && product.store.status === "active" && isVisible(tree, product.categoryId)
    const line: CartLine = {
      id: item.id,
      variantId: variant.id,
      quantity: item.quantity,
      title: product.title,
      slug: product.slug,
      optionValues: variant.optionValues,
      imageUrl: product.images[0]?.url ?? null,
      unitPrice: variant.price,
      stock: variant.stock,
      problem: lineProblem({ quantity: item.quantity, stock: variant.stock, purchasable }),
      maxQuantity: Math.max(1, Math.min(MAX_LINE_QUANTITY, variant.stock)),
    }
    const group = groups.get(product.store.id) ?? { store: { id: product.store.id, name: product.store.name, slug: product.store.slug }, lines: [], subtotal: 0 }
    group.lines.push(line)
    if (!line.problem) group.subtotal += line.unitPrice * line.quantity
    groups.set(product.store.id, group)
  }
  const list = [...groups.values()]
  return {
    cartId: id,
    groups: list,
    count: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: list.reduce((sum, g) => sum + g.subtotal, 0),
    hasProblems: list.some((g) => g.lines.some((l) => l.problem)),
  }
}
