import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { sellerOnly } from '../middleware/auth.js'
import { validate } from '../common/validate.js'
import { badRequest, dbError, forbidden, notFound } from '../common/errors.js'
import { OrderParams } from '../../shared/schemas/orders.js'

const router = Router()
router.use(...sellerOnly)

const STATUS_FLOW = ['Processing', 'Shipped', 'Delivered']

/**
 * @param {{ snapshot: import('../lib/rows.js').ProductSnapshot, product_id: number, qty: number, price: number | string }} row
 */
function rowToLineItem(row) {
  return { ...row.snapshot, id: row.product_id, qty: row.qty, price: Number(row.price) }
}

/** @param {number} n */
const roundMoney = (n) => Math.round(n * 100) / 100

// GET /api/seller/orders — only orders containing this seller's products,
// with only this seller's items embedded (!inner join, filtered in the DB).
router.get('/orders', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, created_at, status, order_items!inner(id, product_id, price, qty, snapshot, seller_id)')
    .eq('order_items.seller_id', req.userId)
    .order('created_at', { ascending: false })
  if (error) throw dbError('list seller orders', error)

  res.json(
    (data ?? []).map((o) => {
      const items = o.order_items.map(rowToLineItem)
      return {
        id: o.id,
        createdAt: o.created_at,
        status: o.status,
        items,
        // Only this seller's share of a possibly multi-seller checkout.
        total: roundMoney(items.reduce((sum, item) => sum + item.qty * item.price, 0)),
      }
    })
  )
})

// PATCH /api/seller/orders/:id/status — advance to the next status.
//
// KNOWN GAP (Phase 6): status lives on the whole order, so on a mixed-seller
// order any one seller advances it for everyone. The fix is per-seller
// sub-orders; see docs/DEVELOPMENT_CHECKLIST.md.
router.patch('/orders/:id/status', validate(OrderParams, 'params'), async (req, res) => {
  const orderId = /** @type {{ id: number }} */ (/** @type {unknown} */ (req.params)).id

  const { data: myItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)
    .eq('seller_id', req.userId)
    .limit(1)
  if (itemsError) throw dbError('check order ownership', itemsError)
  if (!myItems || myItems.length === 0) throw forbidden('Not your order')

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError) throw dbError('load order', orderError)
  if (!order) throw notFound('Order not found')

  const nextIndex = STATUS_FLOW.indexOf(order.status) + 1
  if (nextIndex === 0 || nextIndex >= STATUS_FLOW.length) throw badRequest(`Order is already ${order.status}`)
  const nextStatus = STATUS_FLOW[nextIndex]

  // Conditional update: only applies if nobody changed the status meanwhile,
  // so two sellers clicking at once can't skip a step.
  const { data: updated, error } = await supabaseAdmin
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('status')
  if (error) throw dbError('advance order status', error)
  if (!updated || updated.length === 0) throw badRequest('Order status changed, please refresh')
  res.json({ status: nextStatus })
})

// GET /api/seller/stats — order count + revenue for this seller's dashboard.
router.get('/stats', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('order_items').select('order_id, price, qty').eq('seller_id', req.userId)
  if (error) throw dbError('seller stats', error)

  const rows = data ?? []
  res.json({
    orderCount: new Set(rows.map((r) => r.order_id)).size,
    revenue: roundMoney(rows.reduce((sum, r) => sum + Number(r.price) * r.qty, 0)),
  })
})

export default router
