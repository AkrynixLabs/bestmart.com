"use server"

import { AuthError } from "next-auth"
import { redirect } from "next/navigation"

import { signIn } from "@/auth"
import { echoValues, type FormState } from "@/lib/actions/state"
import { hashPassword } from "@/lib/auth/password"
import { consumeToken, issueToken } from "@/lib/auth/tokens"
import { sendEmail } from "@/lib/email/send"
import { accountExistsMessage, passwordChangedMessage, resetPasswordMessage, verifyEmailMessage } from "@/lib/email/templates"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"
import { clientIp } from "@/lib/request"
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signUpSchema } from "@/lib/validation/auth"
import { email as emailSchema, fieldErrors } from "@/lib/validation/common"

const TOO_MANY = "Too many attempts. Please wait a while and try again."

/** Only allow same-site relative paths as post-login destinations (no open redirects). */
function safeCallback(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : ""
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/account"
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = echoValues(formData)
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }
  const { name, email, phone, password } = parsed.data

  const { allowed } = await checkRateLimit("signup", await clientIp())
  if (!allowed) return { error: TOO_MANY, values }

  // Same response whether or not the email is registered, so the form can't
  // be used to find out who has an account. An existing owner gets an email
  // telling them so instead.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, emailVerifiedAt: true } })
  try {
    if (existing) {
      if (existing.emailVerifiedAt) {
        await sendEmail({ to: email, ...accountExistsMessage(existing.name) })
      } else {
        const token = await issueToken(existing.id, "verify_email")
        await sendEmail({ to: email, ...verifyEmailMessage(existing.name, token) })
      }
    } else {
      const user = await prisma.user.create({ data: { name, email, phone, passwordHash: await hashPassword(password) } })
      const token = await issueToken(user.id, "verify_email")
      await sendEmail({ to: email, ...verifyEmailMessage(name, token) })
      logger.info("account created", { userId: user.id })
    }
  } catch (error) {
    logger.error("sign-up failed", { error })
    return { error: "We couldn't create your account right now. Please try again.", values }
  }
  redirect(`/verify-email/sent?email=${encodeURIComponent(email)}`)
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = echoValues(formData)
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeCallback(formData.get("callbackUrl")) })
  } catch (error) {
    if (error instanceof AuthError) {
      const code = "code" in error ? (error as { code?: string }).code : undefined
      if (code === "rate_limited") return { error: TOO_MANY, values }
      if (code === "suspended") return { error: "This account has been suspended. Contact support if you think this is a mistake.", values }
      if (code === "email_not_verified") {
        return { error: "Please confirm your email address first. We can send you a new link.", values: { ...values, needsVerification: "1" } }
      }
      return { error: "That email and password don't match. Check them and try again.", values }
    }
    throw error // includes Next's redirect on success
  }
  return {}
}

export async function resendVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"))
  if (!parsed.success) return { error: "Enter a valid email address." }
  const email = parsed.data
  const [{ allowed: ipOk }, { allowed: emailOk }] = await Promise.all([
    checkRateLimit("resend-verification", await clientIp()),
    checkRateLimit("resend-verification", `email:${email}`),
  ])
  if (!ipOk || !emailOk) return { error: TOO_MANY }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, emailVerifiedAt: true } })
  if (user && !user.emailVerifiedAt) {
    try {
      const token = await issueToken(user.id, "verify_email")
      await sendEmail({ to: email, ...verifyEmailMessage(user.name, token) })
    } catch (error) {
      logger.error("resend verification failed", { error })
      return { error: "We couldn't send the email right now. Please try again." }
    }
  }
  return { success: "If that address has an unconfirmed account, we've sent a new link. Check your inbox and spam folder." }
}

export async function verifyEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get("token")
  if (typeof token !== "string" || token.length < 20) return { error: "This link is invalid." }
  const userId = await consumeToken(token, "verify_email")
  if (!userId) return { error: "This link has expired or was already used. Sign in to request a new one." }
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
  logger.info("email verified", { userId })
  redirect("/login?verified=1")
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = echoValues(formData)
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }
  const { email } = parsed.data
  const [{ allowed: ipOk }, { allowed: emailOk }] = await Promise.all([
    checkRateLimit("forgot-password", await clientIp()),
    checkRateLimit("forgot-password", `email:${email}`),
  ])
  if (!ipOk || !emailOk) return { error: TOO_MANY, values }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, status: true } })
  if (user && user.status === "active") {
    try {
      const token = await issueToken(user.id, "reset_password")
      await sendEmail({ to: email, ...resetPasswordMessage(user.name, token) })
    } catch (error) {
      logger.error("password reset email failed", { error })
      return { error: "We couldn't send the email right now. Please try again.", values }
    }
  }
  return { success: "If an account exists for that email, we've sent a link to reset your password. It expires in 1 hour." }
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const { token, password } = parsed.data

  const userId = await consumeToken(token, "reset_password")
  if (!userId) return { error: "This reset link has expired or was already used. Request a new one." }
  const user = await prisma.user.update({
    where: { id: userId },
    // Resetting via an emailed link also proves ownership of the address.
    data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
    select: { email: true, name: true, emailVerifiedAt: true },
  })
  sendEmail({ to: user.email, ...passwordChangedMessage(user.name) }).catch((error) => logger.error("password-changed email failed", { error }))
  logger.info("password reset", { userId })
  redirect("/login?reset=1")
}
