"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { FormState } from "@/lib/actions/state"
import { actionUser } from "@/lib/auth/session"
import { cancelOrder } from "@/lib/checkout/orders"
import { prisma } from "@/lib/prisma"

export async function cancelOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return { error: "Your session has ended. Please sign in again." }
  const orderId = String(formData.get("orderId") ?? "")
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id }, select: { number: true } })
  if (!order || !(await cancelOrder(user.id, orderId))) return { error: "This order can't be cancelled any more." }
  revalidatePath("/orders", "layout")
  // The cancel box disappears with the order's status, so confirm at page level.
  redirect(`/orders/${order.number}?cancelled=1`)
}
