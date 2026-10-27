import NextAuth from "next-auth"
import { NextResponse } from "next/server"

import { authConfig } from "./auth.config"

// Runs on every matched request with the edge-safe config only (verifies the
// session cookie, never touches the database). It only answers "is anyone
// signed in?"; role and ownership checks happen in each page/action via
// lib/auth/session.ts, against the database.
const { auth } = NextAuth(authConfig)

const SIGNED_IN_ONLY = ["/account", "/seller", "/admin", "/sell/apply"]
const GUEST_ONLY = ["/login", "/signup"]

export default auth((req) => {
  const { pathname, search } = req.nextUrl
  const signedIn = Boolean(req.auth?.user)

  if (!signedIn && SIGNED_IN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const login = new URL("/login", req.url)
    login.searchParams.set("callbackUrl", `${pathname}${search}`)
    return NextResponse.redirect(login)
  }

  if (signedIn && GUEST_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL("/account", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/account/:path*", "/seller/:path*", "/admin/:path*", "/sell/apply", "/login", "/signup"],
}
