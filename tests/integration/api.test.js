// End-to-end API tests: the real Express app (routes, middleware, Zod
// validation, supabase-js) against an in-memory fake Supabase. Focus is on
// the security rules: the server must ignore client-supplied prices and
// sellers, enforce ownership, and never leak internals.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createFakeSupabase } from '../helpers/fakeSupabase.js'

const BUYER = '11111111-1111-4111-8111-111111111111'
const SELLER = '22222222-2222-4222-8222-222222222222'
const OTHER_SELLER = '33333333-3333-4333-8333-333333333333'

const seed = {
  products: [
    { id: 1000, seller_id: SELLER, seller: 'Real Shop', name: 'Real Lamp', category: 'Home & Living', price: 150, old_price: null, images: [], rating: null, is_new: false, best_seller: false, created_at: '2026-01-01' },
    { id: 1001, seller_id: OTHER_SELLER, seller: 'Other Shop', name: 'Other Mat', category: 'Sports', price: 80, old_price: null, images: [], rating: null, is_new: false, best_seller: false, created_at: '2026-01-02' },
  ],
  cart_items: [],
  orders: [],
  order_items: [],
  conversations: [],
  messages: [],
  profiles: [
    { id: BUYER, name: 'Buyer', email: 'buyer@example.com', is_seller: false, business_name: null },
    { id: SELLER, name: 'Seller', email: 'seller@example.com', is_seller: true, business_name: 'Real Shop' },
    { id: OTHER_SELLER, name: 'Other', email: 'other@example.com', is_seller: true, business_name: 'Other Shop' },
  ],
}
const users = {
  'buyer-token': { id: BUYER, email: 'buyer@example.com' },
  'seller-token': { id: SELLER, email: 'seller@example.com' },
  'other-token': { id: OTHER_SELLER, email: 'other@example.com' },
}

let fake
let app

beforeEach(async () => {
  fake?.restore()
  fake = createFakeSupabase(seed, users)
  app ??= (await import('../../server/app.js')).default
})
afterAll(() => fake?.restore())

const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  patch: (path, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})
const buyer = as('buyer-token')
const seller = as('seller-token')

describe('platform', () => {
  it('sets security headers and a request id', async () => {
    const res = await request(app).get('/api/products')
    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('does not allow arbitrary cross-origin reads', async () => {
    const res = await request(app).get('/api/products').set('Origin', 'https://evil.example')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('serves the same routes under /api/v1', async () => {
    const res = await request(app).get('/api/v1/products')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  it('returns the standard error shape for unknown routes and bad JSON', async () => {
    const missing = await request(app).get('/api/nope')
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ error: 'Not found', code: 'NOT_FOUND' })
    expect(missing.body.requestId).toBeTruthy()

    const badJson = await request(app)
      .post('/api/cart')
      .set('Authorization', 'Bearer buyer-token')
      .set('Content-Type', 'application/json')
      .send('{"oops"')
    expect(badJson.status).toBe(400)
    expect(badJson.body.code).toBe('BAD_REQUEST')
  })

  it('rejects oversized bodies with 413', async () => {
    const res = await buyer.patch('/api/profile', { name: 'x'.repeat(200_000) })
    expect(res.status).toBe(413)
  })

  it('readiness check reports config and database', async () => {
    const res = await request(app).get('/api/health/ready')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, checks: { config: true, database: true } })
  })

  it('never leaks database error messages', async () => {
    fake.restore()
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'relation "secret_table" does not exist', code: '42P01' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    const res = await request(app).get('/api/products')
    expect(res.status).toBe(500)
    expect(res.body.code).toBe('INTERNAL')
    expect(JSON.stringify(res.body)).not.toContain('secret_table')
  })
})

describe('authentication', () => {
  it('requires a bearer token', async () => {
    const res = await request(app).get('/api/cart')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('UNAUTHORIZED')
  })

  it('rejects an invalid token', async () => {
    const res = await as('forged').get('/api/cart')
    expect(res.status).toBe(401)
  })
})

describe('cart and checkout pricing', () => {
  it('ignores a forged price and seller when adding to cart', async () => {
    const res = await buyer.post('/api/cart', { product: { id: 1000, price: 0.01, sellerId: BUYER, name: 'hacked' } })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ price: 150, sellerId: SELLER, name: 'Real Lamp' })
  })

  it('prices demo products from the server catalog', async () => {
    const res = await buyer.post('/api/cart', { productId: 3, price: 1 })
    expect(res.body).toMatchObject({ price: 220, sellerId: null })
  })

  it('404s an unknown product and 400s a malformed id', async () => {
    expect((await buyer.post('/api/cart', { productId: 99999 })).status).toBe(404)
    expect((await buyer.post('/api/cart', { productId: 'abc' })).status).toBe(400)
    expect((await buyer.post('/api/cart', {})).body.error).toBe('productId is required')
  })

  it('validates quantity bounds', async () => {
    await buyer.post('/api/cart', { productId: 1000 })
    expect((await buyer.patch('/api/cart/1000', { qty: 1e9 })).status).toBe(400)
    expect((await buyer.patch('/api/cart/1000', { qty: 0 })).status).toBe(400)
    expect((await buyer.patch('/api/cart/1000', { qty: 2.5 })).status).toBe(400)
    expect((await buyer.patch('/api/cart/1000', { qty: 2 })).status).toBe(200)
    expect((await buyer.patch('/api/cart/1001', { qty: 2 })).status).toBe(404)
  })

  it('re-prices at checkout even if a stored snapshot was tampered with', async () => {
    await buyer.post('/api/cart', { productId: 1000 })
    await buyer.patch('/api/cart/1000', { qty: 2 })
    await buyer.post('/api/cart', { productId: 3 })
    fake.db.cart_items.find((c) => c.product_id === 1000).product_snapshot.price = 0.01

    const res = await buyer.post('/api/checkout')
    expect(res.status).toBe(201)
    expect(res.body.total).toBe(2 * 150 + 220)
    expect(fake.db.order_items.find((i) => i.product_id === 1000).seller_id).toBe(SELLER)
    expect(fake.db.cart_items).toHaveLength(0)
  })

  it('removes unavailable products at checkout with a 409', async () => {
    await buyer.post('/api/cart', { productId: 1000 })
    fake.db.products.length = 0
    const res = await buyer.post('/api/checkout')
    expect(res.status).toBe(409)
    expect(fake.db.cart_items).toHaveLength(0)
    expect(fake.db.orders).toHaveLength(0)
  })

  it('rejects checkout of an empty cart', async () => {
    expect((await buyer.post('/api/checkout')).status).toBe(400)
  })

  it('stops a seller buying their own product', async () => {
    expect((await seller.post('/api/cart', { productId: 1000 })).status).toBe(400)
  })
})

describe('products', () => {
  it('only sellers can create products', async () => {
    const res = await buyer.post('/api/products', { name: 'x', category: 'Beauty', price: 1 })
    expect(res.status).toBe(403)
  })

  it('validates product input', async () => {
    expect((await seller.post('/api/products', { name: 'Mat', category: 'Nope', price: 5 })).body.error).toBe(
      'Choose a valid category'
    )
    expect((await seller.post('/api/products', { name: 'Mat', category: 'Sports', price: -5 })).status).toBe(400)
    expect((await seller.post('/api/products', { name: '  ', category: 'Sports', price: 5 })).status).toBe(400)
    expect(
      (await seller.post('/api/products', { name: 'Mat', category: 'Sports', price: 5, images: ['http://insecure/x.png'] }))
        .status
    ).toBe(400)
    expect((await seller.post('/api/products', { name: 'Mat', category: 'Sports', price: 50, oldPrice: 40 })).status).toBe(400)
  })

  it('ignores platform-controlled fields and sets the seller from the profile', async () => {
    const res = await seller.post('/api/products', {
      name: 'Mat',
      category: 'Sports',
      price: '5.555',
      rating: 5,
      bestSeller: true,
      seller: 'Fake Brand',
      sellerId: BUYER,
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ price: 5.56, seller: 'Real Shop', sellerId: SELLER, bestSeller: false })
    expect(res.body.rating).toBeUndefined()
  })

  it('sets and clears the original price, checked against the stored price', async () => {
    const id = (await seller.post('/api/products', { name: 'Mat', category: 'Sports', price: 5 })).body.id
    expect((await seller.patch(`/api/products/${id}`, { oldPrice: 10 })).body.oldPrice).toBe(10)
    expect((await seller.patch(`/api/products/${id}`, { oldPrice: 4 })).status).toBe(400)
    expect((await seller.patch(`/api/products/${id}`, { price: 20 })).status).toBe(400) // would exceed oldPrice 10
    expect((await seller.patch(`/api/products/${id}`, { oldPrice: null })).body.oldPrice).toBeUndefined()
    expect((await seller.patch(`/api/products/${id}`, {})).status).toBe(400)
  })

  it("forbids editing or deleting another seller's product", async () => {
    expect((await seller.patch('/api/products/1001', { price: 1 })).status).toBe(403)
    expect((await seller.delete('/api/products/1001')).status).toBe(403)
    expect((await seller.delete('/api/products/abc')).status).toBe(400)
    expect((await seller.delete('/api/products/424242')).status).toBe(404)
  })
})

describe('profile', () => {
  it('never lets a user change their email', async () => {
    const res = await buyer.patch('/api/profile', { email: 'ceo@bestmart.com', name: 'B' })
    expect(res.status).toBe(200)
    expect(res.body.email).toBe('buyer@example.com')
  })

  it('validates profile fields', async () => {
    expect((await buyer.patch('/api/profile', { name: '' })).status).toBe(400)
    expect((await buyer.patch('/api/profile', { isSeller: 'yes' })).status).toBe(400)
    expect((await buyer.patch('/api/profile', { businessLogo: 'javascript:alert(1)' })).status).toBe(400)
    const cleared = await buyer.patch('/api/profile', { phone: '   ' })
    expect(cleared.status).toBe(200)
    expect(cleared.body.phone).toBeUndefined()
  })
})

describe('seller orders', () => {
  it("only lists and advances orders containing the seller's items", async () => {
    await buyer.post('/api/cart', { productId: 1000 })
    const order = (await buyer.post('/api/checkout')).body
    const other = as('other-token')
    expect((await other.patch(`/api/seller/orders/${order.id}/status`)).status).toBe(403)
    const advanced = await seller.patch(`/api/seller/orders/${order.id}/status`)
    expect(advanced.body.status).toBe('Shipped')
    expect((await buyer.patch(`/api/seller/orders/${order.id}/status`)).status).toBe(403)
  })
})

describe('messaging', () => {
  it('only opens conversations with real sellers', async () => {
    expect((await seller.post('/api/conversations', { sellerId: BUYER })).status).toBe(404)
    expect((await buyer.post('/api/conversations', { sellerId: 'not-a-uuid' })).status).toBe(400)
    expect((await seller.post('/api/conversations', { sellerId: SELLER })).status).toBe(400)
  })

  it('keeps threads private to their participants', async () => {
    const convo = (await buyer.post('/api/conversations', { sellerId: SELLER })).body
    expect(convo.otherName).toBe('Real Shop')

    const sent = await buyer.post(`/api/conversations/${convo.id}/messages`, { body: '  hello  ', productId: 1000 })
    expect(sent.status).toBe(201)
    expect(sent.body).toMatchObject({ body: 'hello', product_name: 'Real Lamp' })

    const outsider = as('other-token')
    expect((await outsider.get(`/api/conversations/${convo.id}/messages`)).status).toBe(404)
    expect((await outsider.post(`/api/conversations/${convo.id}/messages`, { body: 'hi' })).status).toBe(404)

    const list = await seller.get('/api/conversations')
    expect(list.body[0]).toMatchObject({ preview: 'hello', otherName: 'Buyer', unread: true })
  })

  it('validates message length', async () => {
    const convo = (await buyer.post('/api/conversations', { sellerId: SELLER })).body
    expect((await buyer.post(`/api/conversations/${convo.id}/messages`, { body: '   ' })).status).toBe(400)
    expect((await buyer.post(`/api/conversations/${convo.id}/messages`, { body: 'x'.repeat(2001) })).status).toBe(400)
  })
})
