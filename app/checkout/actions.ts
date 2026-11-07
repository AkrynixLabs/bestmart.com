"use server"

import { redirect } from "next/navigation"

import type { FormState } from "@/lib/actions/state"
import { actionUser } from "@/lib/auth/session"
import { CheckoutError, placeOrder } from "@/lib/checkout/orders"
import { logger } from "@/lib/logger"

export async function placeOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return { error: "Your session has ended. Please sign in again." }
  if (!user.emailVerifiedAt) return { error: "Confirm your email address before placing an order." }
  const addressId = String(formData.get("addressId") ?? "")
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "")
  if (!addressId) return { error: "Choose a delivery address." }
  if (!/^[0-9a-f-]{36}$/.test(idempotencyKey)) return { error: "Please reload the page and try again." }

  let number: string
  try {
    number = (await placeOrder({ userId: user.id, addressId, idempotencyKey })).number
  } catch (error) {
    if (error instanceof CheckoutError) return { error: error.message }
    logger.error("checkout failed", { userId: user.id, error: error instanceof Error ? error.message : String(error) })
    return { error: "We couldn't place your order. Please try again." }
  }
  redirect(`/orders/${number}?placed=1`)
}
