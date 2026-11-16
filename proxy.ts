import NextAuth from "next-auth"
import { NextResponse } from "next/server"

import { authConfig } from "./auth.config"

// Runs on every matched request with the edge-safe config only (verifies the
// session cookie, never touches the database). It only answers "is anyone
// signed in?"; role and ownership checks happen in each page/action via
// lib/auth/session.ts, against the database.
const { auth } = NextAuth(authConfig)

const ADMIN_PATH_HEADER = "x-bm-admin-path" // read in app/admin/layout.tsx
const SIGNED_IN_ONLY = ["/account", "/seller", "/admin", "/sell/apply", "/checkout", "/orders", "/saved"]
const GUEST_ONLY = ["/login", "/signup"]

export default auth((req) => {
  const { pathname, search } = req.nextUrl
  const signedIn = Boolean(req.auth?.user)
  // Only redirect page loads. A form submission (Server Action POST) that got
  // a redirect instead of an action response would crash the page; actions
  // check the session themselves and return a clear error instead.
  if (req.method !== "GET" && req.method !== "HEAD") return NextResponse.next()

  if (!signedIn && SIGNED_IN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const login = new URL("/login", req.url)
    login.searchParams.set("callbackUrl", `${pathname}${search}`)
    return NextResponse.redirect(login)
  }

  if (signedIn && GUEST_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL("/account", req.url))
  }

  // Tell the admin layout which page was asked for, so two-factor can return there.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const headers = new Headers(req.headers)
    headers.set(ADMIN_PATH_HEADER, pathname)
    return NextResponse.next({ request: { headers } })
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/account/:path*", "/seller/:path*", "/admin/:path*", "/sell/apply", "/checkout", "/orders/:path*", "/saved", "/login", "/signup"],
}
