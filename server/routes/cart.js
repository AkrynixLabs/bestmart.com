import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { lookupProduct, parseProductId } from '../lib/catalog.js'

const router = Router()
router.use(authenticate)

export const MAX_QTY = 99

// cart_items row -> the app's cart item shape. product_snapshot holds the
// product's display fields at add-time — built server-side from the real
// product (see lib/catalog.js), never from what the client sent, so price
// and sellerId can't be forged. Checkout re-prices against the live product
// anyway.
function rowToItem(row) {
  return { ...row.product_snapshot, id: row.product_id, qty: row.qty }
}

function parseQty(value) {
  const qty = Number(value)
  return Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY ? qty : null
}

// GET /api/cart
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('cart_items')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    res.json((data ?? []).map(rowToItem))
  })
)

// POST /api/cart — body: { productId } (or legacy { product: { id } }).
// Increments qty if already in the cart. Only the id is read from the body.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const productId = parseProductId(req.body?.productId ?? req.body?.product?.id)
    if (!productId) return res.status(400).json({ error: 'productId is required' })

    const product = await lookupProduct(productId)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    if (product.sellerId && product.sellerId === req.userId) {
      return res.status(400).json({ error: "You can't buy your own product" })
    }

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('cart_items')
      .select('qty')
      .eq('user_id', req.userId)
      .eq('product_id', productId)
      .maybeSingle()
    if (lookupError) return res.status(500).json({ error: lookupError.message })

    if (existing) {
      const qty = Math.min(existing.qty + 1, MAX_QTY)
      const { error } = await supabaseAdmin
        .from('cart_items')
        .update({ qty, product_snapshot: product })
        .eq('user_id', req.userId)
        .eq('product_id', productId)
      if (error) return res.status(400).json({ error: error.message })
      return res.json({ ...product, qty })
    }

    const { error } = await supabaseAdmin
      .from('cart_items')
      .insert({ user_id: req.userId, product_id: productId, qty: 1, product_snapshot: product })
    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json({ ...product, qty: 1 })
  })
)

// PATCH /api/cart/:productId — body: { qty }
router.patch(
  '/:productId',
  asyncHandler(async (req, res) => {
    const productId = parseProductId(req.params.productId)
    if (!productId) return res.status(400).json({ error: 'Invalid product id' })
    const qty = parseQty(req.body?.qty)
    if (!qty) return res.status(400).json({ error: `qty must be a whole number from 1 to ${MAX_QTY}` })

    const { data, error } = await supabaseAdmin
      .from('cart_items')
      .update({ qty })
      .eq('user_id', req.userId)
      .eq('product_id', productId)
      .select('product_id')
    if (error) return res.status(400).json({ error: error.message })
    if (!data || data.length === 0) return res.status(404).json({ error: 'Item is not in your cart' })
    res.json({ ok: true, qty })
  })
)

// DELETE /api/cart/:productId
router.delete(
  '/:productId',
  asyncHandler(async (req, res) => {
    const productId = parseProductId(req.params.productId)
    if (!productId) return res.status(400).json({ error: 'Invalid product id' })
    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('user_id', req.userId)
      .eq('product_id', productId)
    if (error) return res.status(400).json({ error: error.message })
    res.status(204).end()
  })
)

export default router
