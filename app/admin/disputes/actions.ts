"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { echoValues, type FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { ADMIN_ROLES, actionUser } from "@/lib/auth/session"
import { FulfilmentError, resolveDispute } from "@/lib/fulfilment/service"
import { parseGhs } from "@/lib/money"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { optionalText } from "@/lib/validation/common"

export async function resolveDisputeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return { error: "You don't have permission to do that." }
  const values = echoValues(formData)
  const disputeId = String(formData.get("disputeId") ?? "")
  const outcome = String(formData.get("outcome") ?? "")
  if (outcome !== "full_refund" && outcome !== "partial_refund" && outcome !== "rejected") return { fieldErrors: { outcome: "Choose an outcome" }, values }
  const amount = outcome === "partial_refund" ? parseGhs(String(formData.get("amount") ?? "")) : null
  if (outcome === "partial_refund" && (amount === null || amount <= 0)) return { fieldErrors: { amount: "Enter the amount to refund, in cedis" }, values }
  const note = optionalText(500).safeParse(formData.get("note") ?? "")
  if (!note.success) return { fieldErrors: { note: "500 characters at most" }, values }
  try {
    await resolveDispute({ adminId: admin.id, disputeId, outcome, amount, note: note.data ?? null })
  } catch (error) {
    if (error instanceof FulfilmentError) return { error: error.message, values }
    throw error
  }
  await audit({ actorId: admin.id, action: "dispute.resolved", entityType: "dispute", entityId: disputeId, metadata: { outcome, amount }, ip: await clientIp() })
  const d = await prisma.dispute.findUnique({ where: { id: disputeId }, select: { subOrder: { select: { order: { select: { number: true } } } } } })
  revalidatePath(`/admin/orders/${d?.subOrder.order.number ?? ""}`)
  revalidatePath("/admin/disputes")
  // The resolve form disappears once the dispute is closed, so confirm at page level.
  redirect(`/admin/orders/${d?.subOrder.order.number ?? ""}?done=resolved`)
}
