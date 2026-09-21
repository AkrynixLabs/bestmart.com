// Structured, one-line-JSON logger. Vercel (and most log platforms) index
// JSON lines, so fields like requestId and status become searchable.
//
// Redaction is by key name, applied recursively, so a careless
// `logger.info('x', { headers })` can't leak a bearer token or password.

// Substring match, so SUPABASE_SERVICE_ROLE_KEY, x-api-key, refresh_token
// etc. are all caught. Over-redacting a harmless field is the safe failure.
const REDACTED_KEYS = /(authorization|cookie|passw|secret|token|api[-_]?key|service[-_]?role|private[-_]?key|card[-_]?number|cvv)/i
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }

/** @typedef {keyof typeof LEVELS} Level */

const configured = /** @type {Level} */ (process.env.LOG_LEVEL || 'info')
const threshold = LEVELS[configured] ?? LEVELS.info

/**
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
export function redact(value, depth = 0) {
  if (depth > 6 || value === null || typeof value !== 'object') return value
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.cause !== undefined ? { cause: redact(value.cause, depth + 1) } : {}),
    }
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [key, inner] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.test(key) ? '[REDACTED]' : redact(inner, depth + 1)
  }
  return out
}

/**
 * @param {Level} level
 * @param {string} message
 * @param {Record<string, unknown>} [fields]
 */
function write(level, message, fields = {}) {
  if (LEVELS[level] < threshold || process.env.NODE_ENV === 'test') return
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    .../** @type {Record<string, unknown>} */ (redact(fields)),
  })
  if (level === 'error' || level === 'warn') console.error(line)
  else console.log(line)
}

export const logger = {
  /** @param {string} message @param {Record<string, unknown>} [fields] */
  debug: (message, fields) => write('debug', message, fields),
  /** @param {string} message @param {Record<string, unknown>} [fields] */
  info: (message, fields) => write('info', message, fields),
  /** @param {string} message @param {Record<string, unknown>} [fields] */
  warn: (message, fields) => write('warn', message, fields),
  /** @param {string} message @param {Record<string, unknown>} [fields] */
  error: (message, fields) => write('error', message, fields),
}
