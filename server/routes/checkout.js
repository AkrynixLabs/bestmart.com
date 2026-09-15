import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { lookupProducts } from '../lib/catalog.js'

const router = Router()
router.use(authenticate)

const roundMoney = (n) => Math.round(n * 100) / 100

// POST /api/checkout — turns the caller's cart into a real order: one
// `orders` header row plus one `order_items` row per line item (carrying
// seller_id so the seller dashboard can find exactly the orders that
// include their products), then empties the cart.
//
// Prices and seller ids come from the live product (lib/catalog.js), not
// from the cart snapshot, so the buyer pays the current price and can't
// attribute line items to an arbitrary seller.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { data: cartRows, error: cartError } = await supabaseAdmin
      .from('cart_items')
      .select('product_id, qty')
      .eq('user_id', req.userId)
    if (cartError) return res.status(500).json({ error: cartError.message })
    if (!cartRows || cartRows.length === 0) return res.status(400).json({ error: 'Your cart is empty' })

    const live = await lookupProducts(cartRows.map((r) => r.product_id))
    const missing = cartRows.filter((r) => !live.has(r.product_id))
    if (missing.length > 0) {
      // Drop the stale lines so the next attempt can succeed, and tell the
      // buyer why their cart changed.
      await supabaseAdmin
        .from('cart_items')
        .delete()
        .eq('user_id', req.userId)
        .in('product_id', missing.map((r) => r.product_id))
      return res.status(409).json({
        error: 'Some items in your cart are no longer available and were removed. Please review your cart.',
      })
    }

    const lines = cartRows.map((r) => ({ ...live.get(r.product_id), qty: r.qty }))
    if (lines.some((item) => item.sellerId && item.sellerId === req.userId)) {
      return res.status(400).json({ error: "You can't buy your own product" })
    }
    const total = roundMoney(lines.reduce((sum, item) => sum + item.qty * item.price, 0))

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({ user_id: req.userId, total, status: 'Processing' })
      .select()
      .single()
    if (orderError) return res.status(400).json({ error: orderError.message })

    const orderItemRows = lines.map((item) => {
      const { id, qty, price, sellerId, ...snapshot } = item
      return {
        order_id: order.id,
        product_id: id,
        seller_id: sellerId ?? null,
        buyer_id: req.userId,
        price,
        qty,
        snapshot,
      }
    })
    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItemRows)
    if (itemsError) {
      // No multi-statement transactions through PostgREST, so compensate:
      // don't leave an order header with no line items behind.
      await supabaseAdmin.from('orders').delete().eq('id', order.id)
      return res.status(400).json({ error: itemsError.message })
    }

    const { error: clearError } = await supabaseAdmin.from('cart_items').delete().eq('user_id', req.userId)
    if (clearError) console.error('Checkout: order placed but cart not cleared', clearError)

    res.status(201).json({ id: order.id, items: lines, total, status: order.status, createdAt: order.created_at })
  })
)

export default router
