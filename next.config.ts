import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs/config"

// Baseline security headers on every response. A strict Content-Security-
// Policy needs per-request nonces (and Paystack/Sentry origins), so it's
// added with the checkout work in Phase 4 rather than guessed now.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

// Source-map upload needs SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN.
// Without them the build skips the upload and still succeeds.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
})
