import "server-only"
import { z } from "zod"

// Validated server configuration. Read lazily (on first use, not at import)
// so `next build` and tests don't need every secret present, but the first
// request that needs a missing value fails loudly with a clear message.
// Each later phase adds its keys here (Auth.js, Paystack, Resend, ...).

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: "DATABASE_URL must be a postgres:// URL" }),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
})

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source)
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
