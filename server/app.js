import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { requestContext } from './common/requestContext.js'
import { AppError } from './common/errors.js'
import { logger } from './common/logger.js'
import { getEnv } from './config/env.js'
import { supabaseAdmin } from './lib/supabaseAdmin.js'
import profileRouter from './routes/profile.js'
import productsRouter from './routes/products.js'
import cartRouter from './routes/cart.js'
import checkoutRouter from './routes/checkout.js'
import ordersRouter from './routes/orders.js'
import sellerRouter from './routes/seller.js'
import conversationsRouter from './routes/conversations.js'

const app = express()

app.disable('x-powered-by')
// Vercel sits in front of the function; trust its X-Forwarded-For so
// req.ip (used by the rate limiter) is the real client, not the proxy.
app.set('trust proxy', 1)

app.use(requestContext)
// JSON-only API: lock everything down, nothing here renders HTML.
app.use(
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
)
// Same-origin by default (the bundled SPA needs nothing more). Extra
// browser origins must be listed in CORS_ORIGINS. Auth is a bearer header,
// not cookies, so CORS isn't what protects sessions, but there's no reason
// to let arbitrary sites read API responses either.
app.use(
  cors((req, callback) => {
    let allowed = false
    try {
      const origin = req.headers.origin
      allowed = Boolean(origin && getEnv().CORS_ORIGINS.includes(origin))
    } catch {
      // Misconfigured env: deny cross-origin; the request itself will
      // surface the config error.
    }
    callback(null, { origin: allowed, credentials: false, maxAge: 600 })
  })
)
app.use(express.json({ limit: '100kb' }))
app.use((_req, res, next) => {
  // Personalised API responses must never be cached by a shared proxy.
  res.setHeader('Cache-Control', 'no-store')
  next()
})

// Liveness: the function is up. (On Vercel, /api/health itself is served by
// the zero-dependency api/health.js; this one answers in local dev.)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
})

// Readiness: config is valid AND the database answers.
app.get(['/api/health/ready', '/api/v1/health/ready'], async (req, res) => {
  const checks = { config: false, database: false }
  try {
    getEnv()
    checks.config = true
    const { error } = await supabaseAdmin.from('products').select('id', { head: true, count: 'exact' }).limit(1)
    checks.database = !error
    if (error) logger.error('readiness: database check failed', { requestId: req.id, error })
  } catch (error) {
    logger.error('readiness: check failed', { requestId: req.id, error })
  }
  const ok = checks.config && checks.database
  res.status(ok ? 200 : 503).json({ ok, checks })
})

// Versioned API. /api/v1/* is canonical; the unversioned /api/* paths stay
// mounted as aliases so already-deployed clients keep working.
const api = express.Router()
api.use('/profile', profileRouter)
api.use('/products', productsRouter)
api.use('/cart', cartRouter)
api.use('/checkout', checkoutRouter)
api.use('/orders', ordersRouter)
api.use('/seller', sellerRouter)
api.use('/conversations', conversationsRouter)
app.use('/api/v1', api)
app.use('/api', api)

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND', requestId: req.id })
})

/**
 * Central error handler. AppErrors are expected outcomes and are reported
 * as-is. 4xx errors tagged by body-parser (malformed JSON, body too large)
 * are passed through. Anything else is a bug: logged in full (with the
 * request id), answered with a generic 500 that leaks no internals.
 *
 * @type {import('express').ErrorRequestHandler}
 */
const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
      requestId: req.id,
      ...(err.details !== undefined ? { details: err.details } : {}),
    })
  }
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 ? err.status : 500
  if (status < 500) {
    return res.status(status).json({
      error: status === 413 ? 'Request body too large' : 'Bad request',
      code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
      requestId: req.id,
    })
  }
  logger.error('unhandled error', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], error: err })
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.', code: 'INTERNAL', requestId: req.id })
}
app.use(errorHandler)

export default app
