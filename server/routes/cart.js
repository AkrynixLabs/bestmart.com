import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { authenticate } from '../middleware/auth.js'
import { lookupProduct } from '../lib/catalog.js'
import { validate } from '../common/validate.js'
import { badRequest, dbError, notFound } from '../common/errors.js'
import { CartAdd, CartItemParams, CartQtyUpdate, MAX_CART_QTY } from '../../shared/schemas/cart.js'

/** @typedef {import('../lib/rows.js').CartItemRow} CartItemRow */

const router = Router()
router.use(authenticate)

/**
 * product_snapshot is built server-side from the real product (never from
 * the client), and checkout re-prices against the live product anyway.
 * @param {CartItemRow} row
 */
function rowToItem(row) {
  return { ...row.product_snapshot, id: row.product_id, qty: row.qty }
}

/** @param {import('express').Request} req */
const productIdParam = (req) => /** @type {{ productId: number }} */ (/** @type {unknown} */ (req.params)).productId

// GET /api/cart
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('cart_items')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: true })
  if (error) throw dbError('load cart', error)
  res.json(/** @type {CartItemRow[]} */ (data ?? []).map(rowToItem))
})

// POST /api/cart — { productId }. Increments qty if already in the cart.
router.post('/', validate(CartAdd), async (req, res) => {
  const productId = /** @type {number} */ (req.body.productId)
  const product = await lookupProduct(productId)
  if (!product) throw notFound('Product not found')
  if (product.sellerId && product.sellerId === req.userId) throw badRequest("You can't buy your own product")

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('cart_items')
    .select('qty')
    .eq('user_id', req.userId)
    .eq('product_id', productId)
    .maybeSingle()
  if (lookupError) throw dbError('read cart line', lookupError)

  if (existing) {
    const qty = Math.min(existing.qty + 1, MAX_CART_QTY)
    const { error } = await supabaseAdmin
      .from('cart_items')
      .update({ qty, product_snapshot: product })
      .eq('user_id', req.userId)
      .eq('product_id', productId)
    if (error) throw dbError('update cart line', error)
    return res.json({ ...product, qty })
  }

  const { error } = await supabaseAdmin
    .from('cart_items')
    .insert({ user_id: req.userId, product_id: productId, qty: 1, product_snapshot: product })
  if (error) throw dbError('add cart line', error)
  res.status(201).json({ ...product, qty: 1 })
})

// PATCH /api/cart/:productId — { qty }
router.patch('/:productId', validate(CartItemParams, 'params'), validate(CartQtyUpdate), async (req, res) => {
  const { qty } = req.body
  const { data, error } = await supabaseAdmin
    .from('cart_items')
    .update({ qty })
    .eq('user_id', req.userId)
    .eq('product_id', productIdParam(req))
    .select('product_id')
  if (error) throw dbError('change cart qty', error)
  if (!data || data.length === 0) throw notFound('Item is not in your cart')
  res.json({ ok: true, qty })
})

// DELETE /api/cart/:productId
router.delete('/:productId', validate(CartItemParams, 'params'), async (req, res) => {
  const { error } = await supabaseAdmin
    .from('cart_items')
    .delete()
    .eq('user_id', req.userId)
    .eq('product_id', productIdParam(req))
  if (error) throw dbError('remove cart line', error)
  res.status(204).end()
})

export default router
