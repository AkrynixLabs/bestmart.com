// Structured, one-line-JSON logger. Vercel (and most log platforms) index
// JSON lines, so fields like requestId and orderId become searchable.
//
// Redaction is by key name, applied recursively, so a careless
// `logger.info("x", { headers })` can't leak a token or password. Over-
// redacting a harmless field is the safe failure.

const REDACTED_KEYS =
  /(authorization|cookie|passw|secret|token|api[-_]?key|private[-_]?key|card[-_]?number|cvv|ghana[-_]?card|id[-_]?number)/i

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const
type Level = keyof typeof LEVELS
type Fields = Record<string, unknown>

function threshold(): number {
  const configured = process.env.LOG_LEVEL as Level | undefined
  return (configured && LEVELS[configured]) || LEVELS.info
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.cause !== undefined ? { cause: redact(value.cause, depth + 1) } : {}),
    }
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))
  const out: Fields = {}
  for (const [key, inner] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.test(key) ? "[REDACTED]" : redact(inner, depth + 1)
  }
  return out
}

function write(level: Level, message: string, fields: Fields = {}): void {
  if (LEVELS[level] < threshold() || process.env.NODE_ENV === "test") return
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...(redact(fields) as Fields),
  })
  if (level === "error" || level === "warn") console.error(line)
  else console.log(line)
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
}
