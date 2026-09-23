import { describe, expect, it, vi } from 'vitest'
import { redact } from '../../server/common/logger.js'
import { memoryStore, rateLimit } from '../../server/common/rateLimit.js'
import { AppError } from '../../server/common/errors.js'
import { getEnv, resetEnvCache } from '../../server/config/env.js'

describe('redact', () => {
  it('hides secrets at any depth, case-insensitively', () => {
    const out = redact({
      headers: { Authorization: 'Bearer abc', 'x-other': 'ok' },
      body: { password: 'hunter2', nested: [{ access_token: 't' }] },
      SUPABASE_SERVICE_ROLE_KEY: 'k',
    })
    expect(JSON.stringify(out)).not.toMatch(/abc|hunter2|"t"|"k"/)
    expect(out).toMatchObject({ headers: { 'x-other': 'ok' } })
  })
  it('serialises errors with their cause', () => {
    const err = new Error('outer', { cause: { token: 'secret', code: 'X' } })
    expect(redact(err)).toMatchObject({ message: 'outer', cause: { token: '[REDACTED]', code: 'X' } })
  })
})

describe('rateLimit', () => {
  it('allows up to the limit per key, then 429s', async () => {
    const limiter = rateLimit({ name: 't', limit: 2, windowMs: 60_000, store: memoryStore() })
    const req = /** @type {any} */ ({ ip: '1.2.3.4' })
    const res = /** @type {any} */ ({ setHeader: vi.fn() })
    const results = []
    for (let i = 0; i < 3; i++) await limiter(req, res, (err) => results.push(err))
    expect(results[0]).toBeUndefined()
    expect(results[1]).toBeUndefined()
    expect(results[2]).toBeInstanceOf(AppError)
    expect(results[2].status).toBe(429)
  })
  it('resets after the window', () => {
    vi.useFakeTimers()
    const store = memoryStore()
    store.hit('k', 1000)
    store.hit('k', 1000)
    vi.advanceTimersByTime(1001)
    expect(store.hit('k', 1000)).toBe(1)
    vi.useRealTimers()
  })
})

describe('getEnv', () => {
  it('explains what is missing without echoing secret values', () => {
    const saved = { ...process.env }
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.SUPABASE_URL = 'not a url'
    resetEnvCache()
    expect(() => getEnv()).toThrow(/SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY.*SUPABASE_URL/s)
    Object.assign(process.env, saved)
    resetEnvCache()
  })
  it('parses CORS_ORIGINS into a list', () => {
    process.env.CORS_ORIGINS = 'https://a.test, https://b.test ,'
    resetEnvCache()
    expect(getEnv().CORS_ORIGINS).toEqual(['https://a.test', 'https://b.test'])
    delete process.env.CORS_ORIGINS
    resetEnvCache()
  })
})
