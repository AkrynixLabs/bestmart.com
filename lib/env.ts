import "server-only"
import { z } from "zod"

// Validated server configuration. Read lazily (on first use, not at import)
// so `next build` and tests don't need every secret present, but the first
// request that needs a missing value fails loudly with a clear message.
//
// Optional integrations (Google, Resend, Upstash, Blob) have development
// fallbacks; lib/email, lib/storage and lib/rate-limit refuse to fall back in
// production, so a missing key there is an error, not a silent downgrade.

const optional = z.string().trim().min(1).optional()

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: "DATABASE_URL must be a postgres:// URL" }),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Auth.js reads AUTH_SECRET itself; validated here so a missing one is caught early.
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters (run: npx auth secret)"),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default("BestMart <no-reply@bestmart.local>"),

  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: optional,

  BLOB_READ_WRITE_TOKEN: optional,

  // End-to-end test mode for a local/CI production build: local outbox and
  // file storage, no rate limits. Ignored on Vercel production.
  E2E_TEST_MODE: z.literal("1").optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
})

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function parseEnv(source: Record<string, string | undefined>): Env {
  // Treat empty strings (common in .env files) as "not set".
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ""))
  const result = schema.safeParse(cleaned)
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
    throw new Error(`Invalid environment configuration:\n${problems}`)
  }
  return result.data
}

export function env(): Env {
  cached ??= parseEnv(process.env)
  return cached
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production"
}

/** True only for the Playwright server; can never be on in Vercel production. */
export function isE2ETestMode(): boolean {
  const e = env()
  return e.E2E_TEST_MODE === "1" && e.VERCEL_ENV !== "production"
}

/** Whether development fallbacks (local outbox, disk storage) are allowed. */
export function allowDevFallbacks(): boolean {
  return !isProduction() || isE2ETestMode()
}
