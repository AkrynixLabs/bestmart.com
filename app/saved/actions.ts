"use server"

import { revalidatePath } from "next/cache"

import { actionUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

const MAX_SAVED = 500

/** Adds or removes a product from the signed-in user's saved list. */
export async function toggleSavedAction(productId: string): Promise<{ ok: boolean; saved?: boolean; error?: string }> {
  const user = await actionUser()
  if (!user) return { ok: false, error: "Sign in to save products." }
  if (typeof productId !== "string" || !productId) return { ok: false, error: "Unknown product." }
  const existing = await prisma.wishlistItem.findUnique({ where: { userId_productId: { userId: user.id, productId } } })
  if (existing) {
    await prisma.wishlistItem.delete({ where: { userId_productId: { userId: user.id, productId } } })
    revalidatePath("/saved")
    return { ok: true, saved: false }
  }
  if (!(await prisma.product.count({ where: { id: productId } }))) return { ok: false, error: "Unknown product." }
  if ((await prisma.wishlistItem.count({ where: { userId: user.id } })) >= MAX_SAVED) return { ok: false, error: "Your saved list is full." }
  await prisma.wishlistItem.upsert({ where: { userId_productId: { userId: user.id, productId } }, update: {}, create: { userId: user.id, productId } })
  revalidatePath("/saved")
  return { ok: true, saved: true }
}
