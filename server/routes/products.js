import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { authenticate, loadProfile, requireSeller } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { parseProductId } from '../lib/catalog.js'
import { handleImageUpload, isHttpsUrl } from '../lib/imageUpload.js'
import { categories } from '../../src/data/products.js'

const router = Router()

const MAX_IMAGES = 10
const MAX_NAME_LENGTH = 120

// products table (snake_case) <-> API response (camelCase). Every row here
// was, by construction, added by a seller — sellerAdded:true distinguishes
// them from the static demo catalog that stays purely client-side.
function rowToProduct(row) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    seller: row.seller,
    sellerAdded: true,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    oldPrice: row.old_price != null ? Number(row.old_price) : undefined,
    images: row.images ?? [],
    rating: row.rating ?? undefined,
    isNew: row.is_new,
    bestSeller: row.best_seller,
  }
}

const isPositiveMoney = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 10_000_000
const roundMoney = (n) => Math.round(n * 100) / 100

/**
 * Validates a create (partial=false) or update (partial=true) body and maps
 * it to a products row. Only seller-editable fields are accepted: rating,
 * isNew and bestSeller are platform-controlled, and seller/seller_id come
 * from the authenticated profile, not the body.
 */
function validateProductBody(body, { partial, currentPrice }) {
  const row = {}
  const has = (key) => body[key] !== undefined

  if (!partial || has('name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return { error: 'Product name is required' }
    if (name.length > MAX_NAME_LENGTH) return { error: `Product name must be at most ${MAX_NAME_LENGTH} characters` }
    row.name = name
  }

  if (!partial || has('category')) {
    if (!categories.includes(body.category)) return { error: 'Choose a valid category' }
    row.category = body.category
  }

  if (!partial || has('price')) {
    const price = Number(body.price)
    if (!isPositiveMoney(price)) return { error: 'Enter a valid price' }
    row.price = roundMoney(price)
  }

  if ('oldPrice' in body) {
    if (body.oldPrice === null || body.oldPrice === '' || body.oldPrice === undefined) {
      row.old_price = null
    } else {
      const oldPrice = Number(body.oldPrice)
      const price = row.price ?? currentPrice
      if (!isPositiveMoney(oldPrice) || (price != null && oldPrice <= price)) {
        return { error: 'Original price must be higher than the current price' }
      }
      row.old_price = roundMoney(oldPrice)
    }
  }

  if (!partial || has('images')) {
    const images = body.images ?? []
    if (
      !Array.isArray(images) ||
      images.length > MAX_IMAGES ||
      !images.every(isHttpsUrl)
    ) {
      return { error: `images must be a list of up to ${MAX_IMAGES} uploaded image URLs` }
    }
    row.images = images
  }

  return { row }
}

// GET /api/products — public, no auth. Anyone browsing the shop needs this.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin.from('products').select('*').order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    res.json((data ?? []).map(rowToProduct))
  })
)

// POST /api/products/images — any seller. Proxies the file to Supabase
// Storage server-side (multer buffers it in memory; nothing touches disk).
// Scoped to the seller's own folder, not a specific product — photos are
// uploaded while filling out the "Add Product" form, before the product
// exists.
router.post(
  '/images',
  authenticate,
  loadProfile,
  requireSeller,
  ...handleImageUpload
)

// POST /api/products — seller only.
router.post(
  '/',
  authenticate,
  loadProfile,
  requireSeller,
  asyncHandler(async (req, res) => {
    const { row, error: validationError } = validateProductBody(req.body ?? {}, { partial: false })
    if (validationError) return res.status(400).json({ error: validationError })

    const sellerName = req.profile.business_name || req.profile.name || 'BestMart Seller'
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({ ...row, seller_id: req.userId, seller: sellerName, is_new: true })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json(rowToProduct(data))
  })
)

// Ownership check shared by PATCH/DELETE below.
const loadOwnedProduct = asyncHandler(async (req, res, next) => {
  const id = parseProductId(req.params.id)
  if (!id) return res.status(404).json({ error: 'Product not found' })
  const { data, error } = await supabaseAdmin.from('products').select('id, seller_id, price').eq('id', id).maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Product not found' })
  if (data.seller_id !== req.userId) return res.status(403).json({ error: 'Not your product' })
  req.product = data
  next()
})

// PATCH /api/products/:id — seller, owner only.
router.patch(
  '/:id',
  authenticate,
  loadProfile,
  requireSeller,
  loadOwnedProduct,
  asyncHandler(async (req, res) => {
    const { row, error: validationError } = validateProductBody(req.body ?? {}, {
      partial: true,
      currentPrice: Number(req.product.price),
    })
    if (validationError) return res.status(400).json({ error: validationError })
    if (Object.keys(row).length === 0) return res.status(400).json({ error: 'Nothing to update' })

    const { data, error } = await supabaseAdmin.from('products').update(row).eq('id', req.product.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(rowToProduct(data))
  })
)

// DELETE /api/products/:id — seller, owner only.
router.delete(
  '/:id',
  authenticate,
  loadProfile,
  requireSeller,
  loadOwnedProduct,
  asyncHandler(async (req, res) => {
    const { error } = await supabaseAdmin.from('products').delete().eq('id', req.product.id)
    if (error) return res.status(400).json({ error: error.message })
    res.status(204).end()
  })
)

export default router
