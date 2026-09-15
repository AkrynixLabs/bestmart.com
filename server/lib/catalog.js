import { supabaseAdmin } from './supabaseAdmin.js'
import { products as demoProducts } from '../../src/data/products.js'

// Real seller products start at id 1000 (see 002_marketplace.sql); anything
// below that is the static demo catalog, which only exists in code.
const FIRST_DB_PRODUCT_ID = 1000

export function parseProductId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * Looks up products by id from the authoritative source — never from what
 * the client sent. Returns a Map of id -> snapshot in the shape the cart and
 * order line items store (display fields plus price and sellerId). Ids that
 * don't exist are simply absent from the map.
 */
export async function lookupProducts(ids) {
  const found = new Map()
  const dbIds = []

  for (const id of ids) {
    if (id >= FIRST_DB_PRODUCT_ID) {
      dbIds.push(id)
      continue
    }
    const demo = demoProducts.find((p) => p.id === id)
    if (demo) {
      found.set(id, {
        id: demo.id,
        name: demo.name,
        category: demo.category,
        price: demo.price,
        oldPrice: demo.oldPrice,
        seller: demo.seller,
        sellerId: null,
        images: [],
      })
    }
  }

  if (dbIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, seller_id, seller, name, category, price, old_price, images')
      .in('id', dbIds)
    if (error) throw error
    for (const row of data ?? []) {
      found.set(row.id, {
        id: row.id,
        name: row.name,
        category: row.category,
        price: Number(row.price),
        oldPrice: row.old_price ?? undefined,
        seller: row.seller,
        sellerId: row.seller_id,
        sellerAdded: true,
        images: row.images ?? [],
      })
    }
  }

  return found
}

export async function lookupProduct(id) {
  return (await lookupProducts([id])).get(id) ?? null
}
