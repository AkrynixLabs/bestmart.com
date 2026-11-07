"use server"

import { revalidatePath } from "next/cache"

import type { FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { actionUser } from "@/lib/auth/session"
import { bandsSchema, readBands } from "@/lib/delivery/fee"
import type { Prisma } from "@/lib/generated/prisma/client"
import { parseGhs } from "@/lib/money"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"

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
