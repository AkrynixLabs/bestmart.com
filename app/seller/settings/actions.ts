"use server"

import { revalidatePath } from "next/cache"

import { echoValues, type FormState } from "@/lib/actions/state"
import { actionSellerStore } from "@/lib/catalog/seller"
import { prisma } from "@/lib/prisma"
import { optionalText, parsePin } from "@/lib/validation/common"

export async function savePickupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return { error: "Your session has ended or your store isn't active. Please sign in again." }
  const values = echoValues(formData)
  const area = optionalText(80).safeParse(formData.get("pickupArea") ?? "")
  const pin = parsePin(formData.get("latitude"), formData.get("longitude"))
  if (!area.success || !pin.ok) {
    return { fieldErrors: { ...(area.success ? {} : { pickupArea: "Must be 80 characters or fewer" }), ...(pin.ok ? {} : { latitude: pin.error }) }, values }
  }
  await prisma.store.update({ where: { id: seller.store.id }, data: { pickupArea: area.data ?? null, pickupLatitude: pin.latitude, pickupLongitude: pin.longitude } })
  revalidatePath("/seller/settings")
  return { success: "Pickup location saved. New orders use it for delivery fees." }
}
