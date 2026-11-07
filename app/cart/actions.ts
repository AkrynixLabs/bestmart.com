"use server"

import { revalidatePath } from "next/cache"

import { ensureCart, currentCartId } from "@/lib/cart/cart"
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "@/lib/cart/rules"
import { getCurrentUser } from "@/lib/auth/session"
import { getCategoryTree } from "@/lib/catalog/categories"
import { isVisible } from "@/lib/catalog/tree"
import { prisma } from "@/lib/prisma"

export type CartActionResult = { ok: boolean; error?: string; count?: number }

async function cartCount(cartId: string) {
  const sum = await prisma.cartItem.aggregate({ where: { cartId }, _sum: { quantity: true } })
  return sum._sum.quantity ?? 0
}

/** Adds a variant (from the product page). Called directly from the client. */
export async function addToCartAction(variantId: string, quantity: number): Promise<CartActionResult> {
  if (typeof variantId !== "string" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) return { ok: false, error: "Choose a quantity between 1 and 20." }
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { status: true, blockedAt: true, categoryId: true, store: { select: { status: true, userId: true } } } } },
  })
  const tree = await getCategoryTree()
  const p = variant?.product
  if (!variant || !p || !variant.isActive || p.status !== "active" || p.blockedAt || p.store.status !== "active" || !isVisible(tree, p.categoryId)) {
    return { ok: false, error: "This item isn't available right now." }
  }
  const user = await getCurrentUser()
  if (user && p.store.userId === user.id) return { ok: false, error: "This is your own product." }

  const cartId = await ensureCart()
  const existing = await prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } })
  const next = Math.min(MAX_LINE_QUANTITY, (existing?.quantity ?? 0) + quantity)
  if (next > variant.stock) {
    return { ok: false, error: variant.stock === 0 ? "Sorry, this just sold out." : `Only ${variant.stock} left${existing ? ` (you have ${existing.quantity} in your cart)` : ""}.` }
  }
  if (!existing && (await prisma.cartItem.count({ where: { cartId } })) >= MAX_CART_LINES) return { ok: false, error: "Your cart is full. Check out or remove something first." }
  await prisma.cartItem.upsert({ where: { cartId_variantId: { cartId, variantId } }, update: { quantity: next }, create: { cartId, variantId, quantity: next } })
  revalidatePath("/cart")
  return { ok: true, count: await cartCount(cartId) }
}

async function ownLine(lineId: string) {
  const cartId = await currentCartId()
  if (!cartId || !lineId) return null
  return prisma.cartItem.findFirst({ where: { id: lineId, cartId }, include: { variant: { select: { stock: true } } } })
}

export async function updateCartLineAction(formData: FormData): Promise<void> {
  const line = await ownLine(String(formData.get("lineId") ?? ""))
  if (!line) return
  const quantity = Number(formData.get("quantity"))
  if (!Number.isInteger(quantity) || quantity < 0) return
  if (quantity === 0) await prisma.cartItem.delete({ where: { id: line.id } })
  else await prisma.cartItem.update({ where: { id: line.id }, data: { quantity: Math.min(quantity, MAX_LINE_QUANTITY, Math.max(1, line.variant.stock)) } })
  revalidatePath("/cart")
  revalidatePath("/checkout")
}

export async function removeCartLineAction(formData: FormData): Promise<void> {
  const line = await ownLine(String(formData.get("lineId") ?? ""))
  if (line) await prisma.cartItem.delete({ where: { id: line.id } })
  revalidatePath("/cart")
  revalidatePath("/checkout")
}
