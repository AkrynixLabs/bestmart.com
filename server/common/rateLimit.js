import { tooManyRequests } from './errors.js'

/**
 * Fixed-window rate limiter.
 *
 * IMPORTANT LIMITATION: the default store is in-process memory. On Vercel
 * each function instance has its own memory, so the effective limit is
 * "per warm instance", not global. That still blunts a single client
 * hammering an endpoint, but it is NOT a hard guarantee. For a global limit,
 * pass a shared `store` (e.g. Upstash Redis or a Postgres table) that
 * implements the same `hit(key, windowMs)` contract. Tracked in
 * docs/DEVELOPMENT_CHECKLIST.md.
 *
 * @typedef {{ hit(key: string, windowMs: number): Promise<number> | number }} RateLimitStore
 */

/** @returns {RateLimitStore} */
export function memoryStore() {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const windows = new Map()
  return {
    hit(key, windowMs) {
      const now = Date.now()
      // Opportunistic cleanup so the map can't grow without bound.
      if (windows.size > 10_000) {
        for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k)
      }
      const current = windows.get(key)
      if (!current || current.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowMs })
        return 1
      }
      current.count += 1
      return current.count
    },
  }
}

/**
 * @param {{
 *   name: string,
 *   limit: number,
 *   windowMs: number,
 *   key?: (req: import('express').Request) => string,
 *   store?: RateLimitStore,
 * }} options
 * @returns {import('express').RequestHandler}
 */
export function rateLimit({ name, limit, windowMs, key, store = memoryStore() }) {
  // Signed-in callers are limited per account, others per client IP.
  const keyFor = key ?? ((req) => req.userId ?? req.ip ?? 'unknown')
  return async (req, res, next) => {
    try {
      const count = await store.hit(`${name}:${keyFor(req)}`, windowMs)
      res.setHeader('RateLimit-Limit', String(limit))
      res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - count)))
      if (count > limit) {
        res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)))
        return next(tooManyRequests())
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
