import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { authenticate } from '../middleware/auth.js'
import { lookupProducts } from '../lib/catalog.js'
import { badRequest, conflict, dbError } from '../common/errors.js'
import { rateLimit } from '../common/rateLimit.js'
import { logger } from '../common/logger.js'

const router = Router()
router.use(authenticate)

/** @param {number} n */
const roundMoney = (n) => Math.round(n * 100) / 100

// POST /api/checkout — turns the caller's cart into an order (header row +
// one order_items row per line, carrying seller_id), then empties the cart.
//
// Prices and seller ids come from the live product, not the cart snapshot.
//
// KNOWN GAP (Phase 5/6, see docs/DEVELOPMENT_CHECKLIST.md): this is several
// PostgREST calls, not one database transaction, and there is no stock
// reservation or payment step yet. It compensates on failure (deletes the
// order header), but the target design moves this into a single Postgres
// function with row locks and an awaiting_payment status.
router.post('/', rateLimit({ name: 'checkout', limit: 10, windowMs: 60_000 }), async (req, res) => {
  const { data: cartRows, error: cartError } = await supabaseAdmin
    .from('cart_items')
    .select('product_id, qty')
    .eq('user_id', req.userId)
  if (cartError) throw dbError('load cart for checkout', cartError)
  if (!cartRows || cartRows.length === 0) throw badRequest('Your cart is empty')

  const live = await lookupProducts(cartRows.map((r) => r.product_id))
  const missing = cartRows.filter((r) => !live.has(r.product_id))
  if (missing.length > 0) {
    // Drop the stale lines so the next attempt can succeed.
    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('user_id', req.userId)
      .in('product_id', missing.map((r) => r.product_id))
    if (error) throw dbError('drop unavailable cart lines', error)
    throw conflict('Some items in your cart are no longer available and were removed. Please review your cart.')
  }

  const lines = cartRows.map((r) => {
    const product = /** @type {import('../lib/rows.js').ProductSnapshot} */ (live.get(r.product_id))
    return { ...product, qty: /** @type {number} */ (r.qty) }
  })
  if (lines.some((item) => item.sellerId && item.sellerId === req.userId)) {
    throw badRequest("You can't buy your own product")
  }
  const total = roundMoney(lines.reduce((sum, item) => sum + item.qty * item.price, 0))

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({ user_id: req.userId, total, status: 'Processing' })
    .select()
    .single()
  if (orderError) throw dbError('create order', orderError)

  const orderItemRows = lines.map((item) => {
    const { id, qty, price, sellerId, ...snapshot } = item
    return { order_id: order.id, product_id: id, seller_id: sellerId ?? null, buyer_id: req.userId, price, qty, snapshot }
  })
  const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItemRows)
  if (itemsError) {
    // Compensate: don't leave an order header with no line items behind.
    const { error: undoError } = await supabaseAdmin.from('orders').delete().eq('id', order.id)
    if (undoError) logger.error('checkout: could not remove orphaned order', { orderId: order.id, error: undoError })
    throw dbError('create order items', itemsError)
  }

  const { error: clearError } = await supabaseAdmin.from('cart_items').delete().eq('user_id', req.userId)
  if (clearError) {
    logger.error('checkout: order placed but cart not cleared', { requestId: req.id, orderId: order.id, error: clearError })
  }

  logger.info('order placed', { requestId: req.id, orderId: order.id, userId: req.userId, total, lines: lines.length })
  res.status(201).json({ id: order.id, items: lines, total, status: order.status, createdAt: order.created_at })
})

export default router
