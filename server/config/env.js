import { z } from 'zod'

// All server configuration, validated in one place. Read lazily via
// getEnv() (not at import time): throwing during import crashes a Vercel
// function before Express can answer, which surfaces only as an opaque
// FUNCTION_INVOCATION_FAILED. Throwing on first use lands in the error
// handler as a JSON 500 with the reason in the logs.

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_URL: z.url({ message: 'SUPABASE_URL must be the https URL of your Supabase project' }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY is missing'),
  // Comma-separated list of extra origins allowed to call the API from a
  // browser. Empty (the default) = same-origin only, which is all the
  // bundled web app needs.
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
})

/** @typedef {z.infer<typeof EnvSchema>} Env */

/** @type {Env | null} */
let cached = null

/** @returns {Env} */
export function getEnv() {
  if (cached) return cached
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid server configuration (see .env.example): ${problems}`)
  }
  cached = result.data
  return cached
}

/** Test helper: forget the cached config after changing process.env. */
export function resetEnvCache() {
  cached = null
}
