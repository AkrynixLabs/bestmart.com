import { randomUUID } from 'node:crypto'
import { logger } from './logger.js'

// Accept an upstream id (e.g. from a proxy) only if it looks harmless, so a
// client can't inject log lines or huge strings through the header.
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/

/**
 * Gives every request a correlation id (req.id, echoed as X-Request-Id and
 * included in every error body), and logs one structured line per request
 * when the response finishes. Never logs bodies, headers, or query strings,
 * since those can carry tokens or personal data.
 *
 * @type {import('express').RequestHandler}
 */
export const requestContext = (req, res, next) => {
  const incoming = req.get('x-request-id')
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID()
  res.setHeader('X-Request-Id', req.id)

  const started = process.hrtime.bigint()
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'
    logger[level]('request', {
      requestId: req.id,
      method: req.method,
      path: req.baseUrl + req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.userId,
    })
  })
  next()
}
