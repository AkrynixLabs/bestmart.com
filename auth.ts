import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"

import { authConfig } from "./auth.config"
import { burnPasswordCheck, verifyPassword } from "./lib/auth/password"
import { logger } from "./lib/logger"
import { prisma } from "./lib/prisma"
import { checkRateLimit } from "./lib/rate-limit"
import { clientIpFrom } from "./lib/request"
import { loginSchema } from "./lib/validation/auth"

// Distinct codes so the login page can show a specific message. Account-state
// errors are thrown only AFTER the password is proven correct, so they never
// reveal whether an email is registered.
class RateLimitedError extends CredentialsSignin {
  code = "rate_limited"
}
class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified"
}
class SuspendedError extends CredentialsSignin {
  code = "suspended"
}

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

// No database adapter: Auth.js runs against our own `users` table. Every
// database read/write for both providers happens explicitly below.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Route Auth.js logs through our redacting logger. A failed sign-in
  // (CredentialsSignin) is expected user behaviour, not an error.
  logger: {
    error(error) {
      if (error instanceof CredentialsSignin || error.name === "CredentialsSignin") return
      logger.error("auth error", { name: error.name, message: error.message, cause: error.cause instanceof Error ? error.cause.message : undefined })
    },
    warn(code) {
      logger.warn("auth warning", { code })
    },
    debug() {},
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null
        const { email, password } = parsed.data

        const ip = clientIpFrom((name) => request.headers.get(name))
        const [byIp, byEmail] = await Promise.all([checkRateLimit("login", `ip:${ip}`), checkRateLimit("login", `email:${email}`)])
        if (!byIp.allowed || !byEmail.allowed) throw new RateLimitedError()

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user?.passwordHash) {
          await burnPasswordCheck(password)
          return null
        }
        if (!(await verifyPassword(password, user.passwordHash))) return null

        if (user.status === "suspended") throw new SuspendedError()
        if (!user.emailVerifiedAt) throw new EmailNotVerifiedError()

        prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {})
        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
    ...(googleConfigured ? [Google] : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true

      // Only trust an explicit email_verified: true from Google.
      if (!profile?.email || profile.email_verified !== true || !profile.sub) return false
      const email = profile.email.trim().toLowerCase()
      const sub = profile.sub

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        if (existing.status === "suspended") return "/login?error=suspended"
        if (existing.googleId && existing.googleId !== sub) return false // a different Google identity
        await prisma.user.update({
          where: { id: existing.id },
          data: { googleId: sub, emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), lastLoginAt: new Date() },
        })
        return true
      }

      const created = await prisma.user.create({
        data: { email, name: profile.name?.trim() || email.split("@")[0]!, googleId: sub, emailVerifiedAt: new Date(), lastLoginAt: new Date() },
      })
      logger.info("account created via Google", { userId: created.id })
      return true
    },
    async jwt(params) {
      // For Google sign-ins, `user` is Google's profile, not our row: swap in
      // our own id and role.
      if (params.account?.provider === "google" && params.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: params.user.email.toLowerCase() },
          select: { id: true, role: true },
        })
        if (dbUser) {
          params.token.id = dbUser.id
          params.token.role = dbUser.role
          return params.token
        }
      }
      return authConfig.callbacks.jwt(params)
    },
  },
})

export { googleConfigured }
