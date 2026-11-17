"use server"

import { revalidatePath } from "next/cache"

import { echoValues, type FormState } from "@/lib/actions/state"
import { actionSellerStore } from "@/lib/catalog/seller"
import { MessageError, sendAsSeller } from "@/lib/messages/service"
import { checkRateLimit } from "@/lib/rate-limit"

export async function sendSellerMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return { error: "Your session has ended or your store isn't active." }
  const values = echoValues(formData)
  if (!(await checkRateLimit("message", seller.user.id)).allowed) return { error: "You've sent a lot of messages. Please wait a while.", values }
  const conversationId = String(formData.get("conversationId") ?? "")
  try {
    await sendAsSeller({ storeId: seller.store.id, sellerId: seller.user.id, conversationId, body: String(formData.get("body") ?? "") })
  } catch (error) {
    if (error instanceof MessageError) return { fieldErrors: { body: error.message }, values }
    throw error
  }
  revalidatePath(`/seller/messages/${conversationId}`)
  return { success: "Sent." }
}
