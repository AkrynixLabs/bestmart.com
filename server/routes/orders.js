import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { authenticate } from '../middleware/auth.js'
import { dbError } from '../common/errors.js'

const router = Router()
router.use(authenticate)

/**
 * @param {{ snapshot: import('../lib/rows.js').ProductSnapshot, product_id: number, qty: number, price: number | string }} row
 */
function rowToLineItem(row) {
  return { ...row.snapshot, id: row.product_id, qty: row.qty, price: Number(row.price) }
}

// GET /api/orders — the caller's own purchase history (as a buyer).
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, created_at, status, total, order_items(id, product_id, price, qty, snapshot)')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })
  if (error) throw dbError('list orders', error)

  res.json(
    (data ?? []).map((o) => ({
      id: o.id,
      createdAt: o.created_at,
      status: o.status,
      total: Number(o.total),
      items: o.order_items.map(rowToLineItem),
    }))
  )
})

export default router
