import express from 'express'
import cors from 'cors'
import profileRouter from './routes/profile.js'
import productsRouter from './routes/products.js'
import cartRouter from './routes/cart.js'
import checkoutRouter from './routes/checkout.js'
import ordersRouter from './routes/orders.js'
import sellerRouter from './routes/seller.js'
import conversationsRouter from './routes/conversations.js'

const app = express()

app.disable('x-powered-by')
// Auth is a bearer token, not cookies, so a permissive CORS policy can't be
// used to ride on a visitor's session. The SPA is same-origin anyway.
app.use(cors())
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
})

app.use('/api/profile', profileRouter)
app.use('/api/products', productsRouter)
app.use('/api/cart', cartRouter)
app.use('/api/checkout', checkoutRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/seller', sellerRouter)
app.use('/api/conversations', conversationsRouter)

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // body-parser and friends tag client errors (malformed JSON, payload too
  // large) with a 4xx status — pass those through instead of a blanket 500.
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500
  if (status === 500) {
    console.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
  res.status(status).json({ error: status === 413 ? 'Request body too large' : 'Bad request' })
})

export default app
