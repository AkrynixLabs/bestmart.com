"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { actionUser } from "@/lib/auth/session"
import { approveBatch, cancelBatch, PayoutError, prepareBatch, setStoreBankCode } from "@/lib/payouts/service"
import { clientIp } from "@/lib/request"

// Payouts move money out of the platform: Super Admin only, every step audit-logged.

async function superAdmin() {
  return actionUser(["super_admin"])
}

async function attempt(fn: () => Promise<unknown>): Promise<FormState | null> {
  try {
    await fn()
    return null
  } catch (error) {
    if (error instanceof PayoutError) return { error: error.message }
    throw error
  }
}

export async function prepareBatchAction(): Promise<FormState> {
  const admin = await superAdmin()
  if (!admin) return { error: "Only the Super Admin can manage payouts." }
  const failed = await attempt(async () => {
    const batch = await prepareBatch(admin.id)
    await audit({ actorId: admin.id, action: "payout_batch.prepared", entityType: "payout_batch", entityId: batch.id, metadata: { total: batch.total }, ip: await clientIp() })
  })
  if (failed) return failed
  revalidatePath("/admin/payouts")
  redirect("/admin/payouts?done=prepared")
}

export async function approveBatchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await superAdmin()
  if (!admin) return { error: "Only the Super Admin can manage payouts." }
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm you've checked the amounts." }
  const batchId = String(formData.get("batchId") ?? "")
  const failed = await attempt(async () => {
    await approveBatch(batchId, admin.id)
    await audit({ actorId: admin.id, action: "payout_batch.approved", entityType: "payout_batch", entityId: batchId, ip: await clientIp() })
  })
  if (failed) return failed
  revalidatePath("/admin/payouts")
  redirect("/admin/payouts?done=approved")
}

export async function cancelBatchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await superAdmin()
  if (!admin) return { error: "Only the Super Admin can manage payouts." }
  const batchId = String(formData.get("batchId") ?? "")
  const failed = await attempt(async () => {
    await cancelBatch(batchId)
    await audit({ actorId: admin.id, action: "payout_batch.cancelled", entityType: "payout_batch", entityId: batchId, ip: await clientIp() })
  })
  if (failed) return failed
  revalidatePath("/admin/payouts")
  redirect("/admin/payouts?done=cancelled")
}

export async function setBankCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await superAdmin()
  if (!admin) return { error: "Only the Super Admin can manage payouts." }
  const storeId = String(formData.get("storeId") ?? "")
  const bankCode = String(formData.get("bankCode") ?? "")
  const failed = await attempt(async () => {
    await setStoreBankCode(storeId, bankCode)
    await audit({ actorId: admin.id, action: "store.payout_bank_set", entityType: "store", entityId: storeId, metadata: { bankCode }, ip: await clientIp() })
  })
  if (failed) return failed
  revalidatePath("/admin/payouts")
  return { success: "Bank saved." }
}
