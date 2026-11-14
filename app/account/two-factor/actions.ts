"use server"

import { redirect } from "next/navigation"

import type { FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { getCurrentUser, isAdmin } from "@/lib/auth/session"
import { confirmSetup, verifySecondFactor } from "@/lib/auth/two-factor"
import { checkRateLimit } from "@/lib/rate-limit"
import { clientIp } from "@/lib/request"

/** Only same-site admin paths as destinations after verification. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : ""
  return /^\/admin(\/[A-Za-z0-9\-_/]*)?(\?[A-Za-z0-9=&%\-_.]*)?$/.test(next) ? next : "/admin"
}

export type SetupState = FormState & { recoveryCodes?: string[]; next?: string }

export async function confirmSetupAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const user = await getCurrentUser()
  if (!user || !isAdmin(user.role)) return { error: "Two-factor sign-in is for admin accounts." }
  const { allowed } = await checkRateLimit("two-factor", user.id)
  if (!allowed) return { error: "Too many attempts. Wait 15 minutes and try again." }
  const codes = await confirmSetup(user.id, String(formData.get("code") ?? ""))
  if (!codes) return { fieldErrors: { code: "That code didn't match. Check your phone's time is automatic and try the newest code." } }
  await audit({ actorId: user.id, action: "user.two_factor_enabled", entityType: "user", entityId: user.id, ip: await clientIp() })
  // Recovery codes are shown once, from this response; nothing else can show them again.
  return { success: "Two-factor sign-in is on.", recoveryCodes: codes, next: safeNext(formData.get("next")) }
}

export async function verifyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user || !isAdmin(user.role)) return { error: "Two-factor sign-in is for admin accounts." }
  const { allowed } = await checkRateLimit("two-factor", user.id)
  if (!allowed) return { error: "Too many attempts. Wait 15 minutes and try again." }
  const result = await verifySecondFactor(user.id, String(formData.get("code") ?? ""))
  if (result !== "ok") {
    await audit({ actorId: user.id, action: "user.two_factor_failed", entityType: "user", entityId: user.id, ip: await clientIp() })
    return { fieldErrors: { code: "That code isn't right (or was already used)." } }
  }
  redirect(safeNext(formData.get("next")))
}
