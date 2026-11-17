import "server-only"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

import { env, isE2ETestMode, isProduction } from "@/lib/env"
import { logger } from "@/lib/logger"

type Window = `${number} ${"s" | "m" | "h" | "d"}`

const RULES = {
  login: { limit: 10, window: "15 m" },
  signup: { limit: 5, window: "1 h" },
  "forgot-password": { limit: 5, window: "1 h" },
  "resend-verification": { limit: 5, window: "1 h" },
  "seller-application": { limit: 5, window: "1 d" },
  "change-password": { limit: 10, window: "1 h" },
  "category-suggestion": { limit: 10, window: "1 d" },
  "product-image": { limit: 200, window: "1 h" },
  "two-factor": { limit: 10, window: "15 m" },
  message: { limit: 60, window: "1 h" },
} as const satisfies Record<string, { limit: number; window: Window }>

export type RateLimitName = keyof typeof RULES

let limiters: Map<RateLimitName, Ratelimit> | null | undefined

function upstashLimiters(): Map<RateLimitName, Ratelimit> | null {
  if (limiters !== undefined) return limiters
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = env()
  if (!url || !token) {
    if (isProduction()) logger.warn("rate limiting is per-instance only: Upstash is not configured")
    limiters = null
    return null
  }
  const redis = new Redis({ url, token })
  limiters = new Map(
    (Object.keys(RULES) as RateLimitName[]).map((name) => [
      name,
      new Ratelimit({ redis, prefix: `bestmart:rl:${name}`, limiter: Ratelimit.slidingWindow(RULES[name].limit, RULES[name].window) }),
    ])
  )
  return limiters
}

// In-memory fallback for development (and a last line of defence if Upstash
// isn't configured): fixed window per process.
const memory = new Map<string, { count: number; resetAt: number }>()

function windowMs(window: Window): number {
  const [n, unit] = window.split(" ") as [string, "s" | "m" | "h" | "d"]
  return Number(n) * { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]
}

export function checkMemoryLimit(name: RateLimitName, key: string, now = Date.now()): boolean {
  const { limit, window } = RULES[name]
  const id = `${name}:${key}`
  const entry = memory.get(id)
  if (!entry || entry.resetAt <= now) {
    memory.set(id, { count: 1, resetAt: now + windowMs(window) })
    return true
  }
  entry.count += 1
  return entry.count <= limit
}

/**
 * Returns whether the action is allowed. Fails open if Upstash errors: a
 * Redis outage must not lock every customer out of logging in.
 */
export async function checkRateLimit(name: RateLimitName, key: string): Promise<{ allowed: boolean }> {
  if (isE2ETestMode()) return { allowed: true }
  const upstash = upstashLimiters()
  if (!upstash) return { allowed: checkMemoryLimit(name, key) }
  try {
    const result = await upstash.get(name)!.limit(key)
    return { allowed: result.success }
  } catch (error) {
    logger.error("rate limit check failed; allowing request", { name, error })
    return { allowed: true }
  }
}
