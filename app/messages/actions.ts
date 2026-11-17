"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { echoValues, type FormState } from "@/lib/actions/state"
import { actionUser } from "@/lib/auth/session"
import { MessageError, sendAsBuyer } from "@/lib/messages/service"
import { checkRateLimit } from "@/lib/rate-limit"

export async function sendBuyerMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser()
  if (!user) return { error: "Your session has ended. Please sign in again." }
  const values = echoValues(formData)
  if (!(await checkRateLimit("message", user.id)).allowed) return { error: "You've sent a lot of messages. Please wait a while.", values }
  const storeId = String(formData.get("storeId") ?? "")
  let conversationId: string
  try {
    conversationId = await sendAsBuyer({
      buyerId: user.id,
      storeId,
      body: String(formData.get("body") ?? ""),
      productId: String(formData.get("productId") ?? "") || null,
      orderNumber: String(formData.get("orderNumber") ?? "") || null,
    })
  } catch (error) {
    if (error instanceof MessageError) return { fieldErrors: { body: error.message }, values }
    throw error
  }
  revalidatePath(`/messages/${conversationId}`)
  // A first message comes from /messages/new: continue in the thread.
  if (formData.get("fromNew") === "1") redirect(`/messages/${conversationId}`)
  return { success: "Sent." }
}

