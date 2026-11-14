"use server"

import { revalidatePath } from "next/cache"

import { z } from "zod"

import { echoValues, type FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { actionUser } from "@/lib/auth/session"
import { bandsSchema, readBands } from "@/lib/delivery/fee"
import type { Prisma } from "@/lib/generated/prisma/client"
import { parseGhs } from "@/lib/money"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { fieldErrors, normaliseGhanaPhone } from "@/lib/validation/common"

/** Money settings are Super Admin only. */
export async function saveDeliverySettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(["super_admin"])
  if (!admin) return { error: "Only the Super Admin can change delivery fees." }

  const upTo = formData.getAll("upToKm").map(String)
  const fees = formData.getAll("fee").map(String)
  if (upTo.length !== fees.length || upTo.length === 0) return { error: "Something went wrong reading the bands. Please reload." }
  const raw = upTo.map((km, i) => ({ upToKm: i === upTo.length - 1 ? null : km.trim() === "" ? NaN : Number(km), feePesewas: parseGhs(fees[i] ?? "") ?? NaN }))
  if (raw.some((b) => Number.isNaN(b.feePesewas))) return { error: "Enter every fee in cedis, e.g. 15 or 22.50." }
  if (raw.some((b) => b.upToKm !== null && !Number.isFinite(b.upToKm))) return { error: "Enter a distance in km for every band except the last." }
  const bands = bandsSchema.safeParse(raw)
  if (!bands.success) return { error: bands.error.issues[0]?.message ?? "Check the bands." }
  const factor = Number(formData.get("roadFactorPct"))
  if (!Number.isInteger(factor) || factor < 100 || factor > 300) return { error: "The road factor must be a whole number between 100 and 300." }

  const before = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } })
  await prisma.$transaction(async (tx) => {
    await tx.platformSettings.update({ where: { id: 1 }, data: { deliveryBands: bands.data as Prisma.InputJsonValue, deliveryRoadFactorPct: factor } })
    await audit(
      {
        actorId: admin.id,
        action: "settings.delivery_updated",
        entityType: "platform_settings",
        entityId: "1",
        metadata: { from: { bands: readBands(before.deliveryBands), roadFactorPct: before.deliveryRoadFactorPct }, to: { bands: bands.data, roadFactorPct: factor } } as Prisma.InputJsonValue,
        ip: await clientIp(),
      },
      tx,
    )
  })
  revalidatePath("/admin/settings")
  return { success: "Delivery fees saved. They apply to new checkouts; existing orders keep their fee." }
}

const generalSchema = z.object({
  commissionPercent: z.coerce.number({ error: "Enter a number" }).min(0, "At least 0").max(50, "At most 50%"),
  stockReservationMinutes: z.coerce.number().int("Whole minutes").min(5, "At least 5 minutes").max(120, "At most 120 minutes"),
  shipWithinDays: z.coerce.number().int("Whole days").min(1, "At least 1 day").max(30, "At most 30 days"),
  autoConfirmDeliveryDays: z.coerce.number().int("Whole days").min(1, "At least 1 day").max(60, "At most 60 days"),
  payoutHoldDays: z.coerce.number().int("Whole days").min(0, "0 or more").max(30, "At most 30 days"),
  returnWindowDays: z.coerce.number().int("Whole days").min(0, "0 or more").max(60, "At most 60 days"),
  lowStockThreshold: z.coerce.number().int("Whole number").min(0, "0 or more").max(1000, "At most 1000"),
  payoutMinimum: z.string().transform((v, ctx) => {
    const p = parseGhs(v)
    if (p === null || p < 100) {
      ctx.addIssue({ code: "custom", message: "At least GH₵1.00" })
      return z.NEVER
    }
    return p
  }),
  payoutWeekday: z.coerce.number().int().min(0).max(6),
  supportEmail: z.string().trim().max(120).optional().transform((v) => v || null).pipe(z.email("Enter a valid email").nullable()),
  supportPhone: z.string().trim().optional().transform((v, ctx) => {
    if (!v) return null
    const phone = normaliseGhanaPhone(v)
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a Ghana phone number" })
      return z.NEVER
    }
    return phone
  }),
})

/** Every business-rule number lives here (CLAUDE.md); changes are audit-logged with before/after values. */
export async function saveGeneralSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(["super_admin"])
  if (!admin) return { error: "Only the Super Admin can change settings." }
  const values = echoValues(formData)
  const parsed = generalSchema.safeParse(values)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }
  const { commissionPercent, ...rest } = parsed.data
  const data = { ...rest, commissionBps: Math.round(commissionPercent * 100) }
  const before = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } })
  const changed = Object.fromEntries(Object.entries(data).filter(([k, v]) => before[k as keyof typeof before] !== v).map(([k, v]) => [k, { from: before[k as keyof typeof before], to: v }]))
  if (Object.keys(changed).length === 0) return { success: "No changes to save." }
  await prisma.$transaction(async (tx) => {
    await tx.platformSettings.update({ where: { id: 1 }, data })
    await audit({ actorId: admin.id, action: "settings.updated", entityType: "platform_settings", entityId: "1", metadata: changed as Prisma.InputJsonValue, ip: await clientIp() }, tx)
  })
  revalidatePath("/admin/settings")
  return { success: `Saved ${Object.keys(changed).length} change(s). They apply from now on; existing orders keep the rules they were placed under.` }
}
