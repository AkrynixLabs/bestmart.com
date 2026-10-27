import type { NextAuthConfig } from "next-auth"

import type { Role } from "@/lib/generated/prisma/client"

// Edge-safe part of the Auth.js config (no Prisma, no bcrypt), shared by
// proxy.ts. Providers that need the database live in auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        // For display only (menus). Every permission check re-reads the role
        // from the database (lib/auth/session.ts), so a role change or a
        // suspension takes effect immediately, not when the token expires.
        session.user.role = token.role as Role
      }
      return session
    },
  },
} satisfies NextAuthConfig
