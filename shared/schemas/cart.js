import { z } from 'zod'
import { Id } from './common.js'

export const MAX_CART_QTY = 99

// { productId } — or the legacy { product: { id } } shape older clients send.
// Only the id is ever read; price/seller come from the server catalog.
export const CartAdd = z.preprocess(
  (body) => {
    const b = /** @type {{ productId?: unknown, product?: { id?: unknown } } | null} */ (body)
    return { productId: b?.productId ?? b?.product?.id }
  },
  z.object({ productId: Id.optional() }).refine((b) => b.productId !== undefined, {
    message: 'productId is required',
    path: ['productId'],
  })
)

export const CartQtyUpdate = z.object({
  qty: z.coerce
    .number()
    .int(`qty must be a whole number from 1 to ${MAX_CART_QTY}`)
    .min(1, `qty must be a whole number from 1 to ${MAX_CART_QTY}`)
    .max(MAX_CART_QTY, `qty must be a whole number from 1 to ${MAX_CART_QTY}`),
})

export const CartItemParams = z.object({ productId: Id })
