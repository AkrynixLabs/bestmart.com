"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { echoValues, type FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { ADMIN_ROLES, actionUser } from "@/lib/auth/session"
import { parseGhs } from "@/lib/money"
import { issueRefund } from "@/lib/payments/service"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { requiredText } from "@/lib/validation/common"

export async function refundAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return { error: "You don't have permission to do that." }
  const values = echoValues(formData)
  const subOrderId = String(formData.get("subOrderId") ?? "")
  const amount = parseGhs(String(formData.get("amount") ?? ""))
  const reason = requiredText("Reason", 300).safeParse(formData.get("reason") ?? "")
  if (amount === null || amount <= 0) return { fieldErrors: { amount: "Enter an amount in cedis, e.g. 45 or 12.50" }, values }
  if (!reason.success) return { fieldErrors: { reason: reason.error.issues[0]?.message ?? "Give a reason" }, values }

  const result = await issueRefund({ subOrderId, amount, reason: reason.data, createdById: admin.id })
  if (!result.ok) return { error: result.error, values }
  const sub = await prisma.subOrder.findUnique({ where: { id: subOrderId }, select: { order: { select: { number: true } } } })
  await audit({ actorId: admin.id, action: "refund.issued", entityType: "sub_order", entityId: subOrderId, metadata: { amount, reason: reason.data, status: result.status }, ip: await clientIp() })
  revalidatePath(`/admin/orders/${sub?.order.number ?? ""}`)
  // A full refund removes the refund form, so confirm at page level.
  redirect(`/admin/orders/${sub?.order.number ?? ""}?done=${result.status === "processed" ? "refunded" : "refund_pending"}`)
}
