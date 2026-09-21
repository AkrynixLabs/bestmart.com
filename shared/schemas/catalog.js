import { z } from 'zod'
import { categories } from '../catalog.js'
import { HttpsUrl, Id, Money } from './common.js'

export const MAX_PRODUCT_IMAGES = 10
export const MAX_PRODUCT_NAME = 120

/** '' / null clear the original price; anything else must be valid money. */
const OldPrice = z.union([z.literal('').transform(() => null), z.null(), Money])

// Only seller-editable fields. rating / isNew / bestSeller are platform
// controlled and seller / sellerId come from the authenticated profile, so
// they're not in the schema and are stripped if sent.
const ProductFields = z.object({
  name: z
    .string({ message: 'Product name is required' })
    .trim()
    .min(1, 'Product name is required')
    .max(MAX_PRODUCT_NAME, `Product name must be at most ${MAX_PRODUCT_NAME} characters`),
  category: z.enum(/** @type {[string, ...string[]]} */ (categories), { message: 'Choose a valid category' }),
  price: Money,
  oldPrice: OldPrice.optional(),
  images: z
    .array(HttpsUrl, { message: `images must be a list of up to ${MAX_PRODUCT_IMAGES} uploaded image URLs` })
    .max(MAX_PRODUCT_IMAGES, `A product can have at most ${MAX_PRODUCT_IMAGES} images`),
})

const ORIGINAL_PRICE_MESSAGE = 'Original price must be higher than the current price'

export const ProductCreate = ProductFields.extend({ images: ProductFields.shape.images.default([]) }).refine(
  (p) => p.oldPrice == null || p.oldPrice > p.price,
  { message: ORIGINAL_PRICE_MESSAGE, path: ['oldPrice'] }
)

// The oldPrice-vs-price rule on update needs the stored price too, so the
// route re-checks it with the merged values (see checkOriginalPrice).
export const ProductUpdate = ProductFields.partial()

/**
 * @param {number | null | undefined} oldPrice
 * @param {number} price
 * @returns {string | null} error message, or null when valid
 */
export function checkOriginalPrice(oldPrice, price) {
  return oldPrice == null || oldPrice > price ? null : ORIGINAL_PRICE_MESSAGE
}

export const ProductIdParams = z.object({ id: Id })

/** @typedef {z.infer<typeof ProductCreate>} ProductCreateInput */
/** @typedef {z.infer<typeof ProductUpdate>} ProductUpdateInput */
