// Shared Sentry settings for the browser, Node and edge runtimes.
// Sentry stays off until BestMart's own project exists (NEXT_PUBLIC_SENTRY_DSN).
//
// Privacy: a marketplace handles addresses, phone numbers and payment
// references, so request/response bodies, cookies and automatic user fields
// are NOT sent. Errors and stack traces are enough to debug; attach specific
// ids (orderId, userId) explicitly where they help.
export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN

export const sentryOptions = {
  dsn: sentryDsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpBodies: [],
  },
}
