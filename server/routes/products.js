import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { sellerOnly } from '../middleware/auth.js'
import { handleImageUpload } from '../lib/imageUpload.js'
import { validate } from '../common/validate.js'
import { badRequest, dbError, forbidden, notFound } from '../common/errors.js'
import { rateLimit } from '../common/rateLimit.js'
import { ProductCreate, ProductIdParams, ProductUpdate, checkOriginalPrice } from '../../shared/schemas/catalog.js'

/** @typedef {import('../lib/rows.js').ProductRow} ProductRow */

const router = Router()

const uploadLimit = rateLimit({ name: 'product-images', limit: 30, windowMs: 10 * 60_000 })

/**
 * products row (snake_case) -> API response (camelCase). sellerAdded:true
 * distinguishes DB products from the static demo catalog.
 * @param {ProductRow} row
 */
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
    rating: row.rating != null ? Number(row.rating) : undefined,
    isNew: row.is_new,
    bestSeller: row.best_seller,
  }
}

/**
 * Validated camelCase input -> products columns (only the keys provided).
 * @param {import('../../shared/schemas/catalog.js').ProductUpdateInput} input
 */
function inputToRow(input) {
  /** @type {Partial<ProductRow>} */
  const row = {}
  if (input.name !== undefined) row.name = input.name
  if (input.category !== undefined) row.category = input.category
  if (input.price !== undefined) row.price = input.price
  if (input.oldPrice !== undefined) row.old_price = input.oldPrice
  if (input.images !== undefined) row.images = input.images
  return row
}

// GET /api/products — public. Anyone browsing the shop needs this.
router.get('/', async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('products').select('*').order('created_at', { ascending: true })
  if (error) throw dbError('list products', error)
  res.json(/** @type {ProductRow[]} */ (data ?? []).map(rowToProduct))
})

// POST /api/products/images — any seller. Photos are uploaded while filling
// in the product form, before the product exists, so they're scoped to the
// seller's folder rather than a product.
router.post('/images', ...sellerOnly, uploadLimit, ...handleImageUpload)

// POST /api/products — seller only. seller name, seller_id and is_new are
// set here from the authenticated profile, never from the body.
router.post('/', ...sellerOnly, validate(ProductCreate), async (req, res) => {
  const input = /** @type {import('../../shared/schemas/catalog.js').ProductCreateInput} */ (req.body)
  const sellerName = req.profile.business_name || req.profile.name || 'BestMart Seller'
  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({ ...inputToRow(input), seller_id: req.userId, seller: sellerName, is_new: true })
    .select()
    .single()
  if (error) throw dbError('create product', error)
  res.status(201).json(rowToProduct(data))
})

/**
 * Ownership check shared by PATCH/DELETE: sets req.product or 403/404s.
 * @type {import('express').RequestHandler}
 */
const loadOwnedProduct = async (req, _res, next) => {
  const { id } = /** @type {{ id: number }} */ (/** @type {unknown} */ (req.params))
  const { data, error } = await supabaseAdmin.from('products').select('*').eq('id', id).maybeSingle()
  if (error) throw dbError('load product', error)
  if (!data) throw notFound('Product not found')
  if (data.seller_id !== req.userId) throw forbidden('Not your product')
  req.product = data
  next()
}

// PATCH /api/products/:id — owner only.
router.patch(
  '/:id',
  ...sellerOnly,
  validate(ProductIdParams, 'params'),
  loadOwnedProduct,
  validate(ProductUpdate),
  async (req, res) => {
    const input = /** @type {import('../../shared/schemas/catalog.js').ProductUpdateInput} */ (req.body)
    const row = inputToRow(input)
    if (Object.keys(row).length === 0) throw badRequest('Nothing to update')

    // Cross-field rule against the merged (new or stored) values.
    const price = input.price ?? Number(req.product.price)
    const oldPrice =
      input.oldPrice !== undefined ? input.oldPrice : req.product.old_price != null ? Number(req.product.old_price) : null
    const priceProblem = checkOriginalPrice(oldPrice, price)
    if (priceProblem) throw badRequest(priceProblem)

    const { data, error } = await supabaseAdmin.from('products').update(row).eq('id', req.product.id).select().single()
    if (error) throw dbError('update product', error)
    res.json(rowToProduct(data))
  }
)

// DELETE /api/products/:id — owner only.
router.delete('/:id', ...sellerOnly, validate(ProductIdParams, 'params'), loadOwnedProduct, async (req, res) => {
  const { error } = await supabaseAdmin.from('products').delete().eq('id', req.product.id)
  if (error) throw dbError('delete product', error)
  res.status(204).end()
})

export default router
