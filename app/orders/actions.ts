"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { echoValues, type FormState } from "@/lib/actions/state"
import { actionUser } from "@/lib/auth/session"
import { cancelOrder } from "@/lib/checkout/orders"
import { cancelSubOrder, confirmDelivery, FulfilmentError, openDispute } from "@/lib/fulfilment/service"
import { PaymentError, startPayment } from "@/lib/payments/service"
import { prisma } from "@/lib/prisma"
import { siteOrigin } from "@/lib/request"
import { requiredText } from "@/lib/validation/common"

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

export async function startPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return { error: "Your session has ended. Please sign in again." }
  let url: string
  try {
    url = await startPayment({ userId: user.id, email: user.email, orderNumber: String(formData.get("orderNumber") ?? ""), origin: await siteOrigin() })
  } catch (error) {
    if (error instanceof PaymentError) return { error: error.message }
    throw error
  }
  redirect(url)
}

// ---------------------------------------------------------------------------
// Fulfilment (buyer side)
// ---------------------------------------------------------------------------

async function orderNumberFor(userId: string, subOrderId: string) {
  return (await prisma.subOrder.findFirst({ where: { id: subOrderId, order: { userId } }, select: { order: { select: { number: true } } } }))?.order.number ?? null
}

export async function confirmDeliveryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return { error: "Your session has ended. Please sign in again." }
  const subOrderId = String(formData.get("subOrderId") ?? "")
  try {
    await confirmDelivery(user.id, subOrderId)
  } catch (error) {
    if (error instanceof FulfilmentError) return { error: error.message }
    throw error
  }
  const number = await orderNumberFor(user.id, subOrderId)
  revalidatePath(`/orders/${number}`)
  // The confirm button disappears with the status change, so confirm at page level.
  redirect(`/orders/${number}?confirmed=1`)
}

export async function buyerCancelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return { error: "Your session has ended. Please sign in again." }
  const subOrderId = String(formData.get("subOrderId") ?? "")
  try {
    await cancelSubOrder({ subOrderId, actor: { kind: "buyer", id: user.id }, reason: "Not shipped within the time allowed" })
  } catch (error) {
    if (error instanceof FulfilmentError) return { error: error.message }
    throw error
  }
  const number = await orderNumberFor(user.id, subOrderId)
  revalidatePath(`/orders/${number}`)
  redirect(`/orders/${number}?partCancelled=1`)
}

export async function openDisputeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return { error: "Your session has ended. Please sign in again." }
  const values = echoValues(formData)
  const subOrderId = String(formData.get("subOrderId") ?? "")
  const reason = String(formData.get("reason") ?? "")
  const description = requiredText("Description", 2000).safeParse(formData.get("description") ?? "")
  if (!["not_received", "faulty", "not_as_described", "other"].includes(reason)) return { fieldErrors: { reason: "Choose what's wrong" }, values }
  if (!description.success || description.data.length < 10) return { fieldErrors: { description: "Describe the problem in a sentence or two" }, values }
  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0)
  try {
    await openDispute({ buyerId: user.id, subOrderId, reason: reason as "not_received", description: description.data, photos })
  } catch (error) {
    if (error instanceof FulfilmentError) return { error: error.message, values }
    throw error
  }
  const number = await orderNumberFor(user.id, subOrderId)
  revalidatePath(`/orders/${number}`)
  redirect(`/orders/${number}?reported=1`)
}
