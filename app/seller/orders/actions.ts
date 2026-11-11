"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { echoValues, type FormState } from "@/lib/actions/state"
import { actionSellerStore } from "@/lib/catalog/seller"
import { acceptSubOrder, cancelSubOrder, FulfilmentError, markShipped, respondToDispute } from "@/lib/fulfilment/service"
import { normaliseGhanaPhone, requiredText } from "@/lib/validation/common"

const SIGNED_OUT: FormState = { error: "Your session has ended or your store isn't active. Please sign in again." }

/**
 * Runs a fulfilment step. Steps that change the status redirect with a
 * `done` flag: the form that triggered them disappears with the old status,
 * so the confirmation is shown at page level.
 */
async function run(id: string, fn: () => Promise<void>, success: string, done?: "accepted" | "shipped" | "cancelled"): Promise<FormState> {
  try {
    await fn()
  } catch (error) {
    if (error instanceof FulfilmentError) return { error: error.message }
    throw error
  }
  revalidatePath(`/seller/orders/${id}`)
  revalidatePath("/seller/orders")
  if (done) redirect(`/seller/orders/${id}?done=${done}`)
  return { success }
}

export async function acceptOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return SIGNED_OUT
  const id = String(formData.get("subOrderId") ?? "")
  return run(id, () => acceptSubOrder(seller.store.id, seller.user.id, id), "Accepted.", "accepted")
}

export async function shipOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return SIGNED_OUT
  const values = echoValues(formData)
  const id = String(formData.get("subOrderId") ?? "")
  const method = formData.get("method") === "courier" ? "courier" : formData.get("method") === "own_rider" ? "own_rider" : null
  const name = requiredText(method === "courier" ? "Courier name" : "Rider's name", 80).safeParse(formData.get("carrierName") ?? "")
  const phoneRaw = String(formData.get("riderPhone") ?? "").trim()
  const tracking = String(formData.get("trackingNumber") ?? "").trim().slice(0, 80)
  const phone = phoneRaw ? normaliseGhanaPhone(phoneRaw) : null

  const errors: Record<string, string> = {}
  if (!method) errors.method = "Choose how it's being delivered"
  if (!name.success) errors.carrierName = name.error.issues[0]?.message ?? "Required"
  if (phoneRaw && !phone) errors.riderPhone = "Enter a Ghana phone number, e.g. 024 123 4567"
  if (method === "own_rider" && !phoneRaw) errors.riderPhone = "Give the rider's phone number so the buyer can reach them"
  if (method === "courier" && !tracking && !phoneRaw) errors.trackingNumber = "Give a tracking number or a phone number"
  if (Object.keys(errors).length > 0 || !method || !name.success) return { fieldErrors: errors, values }

  return run(id, () => markShipped(seller.store.id, seller.user.id, id, { method, carrierName: name.data, riderPhone: phone, trackingNumber: tracking || null }), "Shipped.", "shipped")
}

export async function sellerCancelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return SIGNED_OUT
  const values = echoValues(formData)
  const id = String(formData.get("subOrderId") ?? "")
  const reason = requiredText("Reason", 300).safeParse(formData.get("reason") ?? "")
  if (!reason.success) return { fieldErrors: { reason: "Tell the buyer why (they'll see it)" }, values }
  return run(id, () => cancelSubOrder({ subOrderId: id, actor: { kind: "seller", id: seller.user.id, storeId: seller.store.id }, reason: reason.data }), "Cancelled.", "cancelled")
}

export async function respondToDisputeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return SIGNED_OUT
  const values = echoValues(formData)
  const id = String(formData.get("subOrderId") ?? "")
  const response = requiredText("Your response", 1000).safeParse(formData.get("response") ?? "")
  if (!response.success) return { fieldErrors: { response: response.error.issues[0]?.message ?? "Required" }, values }
  return run(id, () => respondToDispute(seller.store.id, String(formData.get("disputeId") ?? ""), response.data), "Response sent to our team.")
}
