import { describe, expect, it } from 'vitest'
import { Money, Id } from '../../shared/schemas/common.js'
import { ProductCreate, ProductUpdate, checkOriginalPrice } from '../../shared/schemas/catalog.js'
import { CartAdd, CartQtyUpdate } from '../../shared/schemas/cart.js'
import { ProfileUpdate } from '../../shared/schemas/profile.js'
import { MessageCreate } from '../../shared/schemas/messaging.js'

describe('Money', () => {
  it('rounds to pesewas and accepts numeric strings', () => {
    expect(Money.parse('10.005')).toBe(10.01)
    expect(Money.parse(0.1 + 0.2)).toBe(0.3)
  })
  it.each([0, -1, 'abc', Infinity, 10_000_000, null])('rejects %s', (value) => {
    expect(Money.safeParse(value).success).toBe(false)
  })
})

describe('Id', () => {
  it('accepts positive integers and numeric strings', () => {
    expect(Id.parse('42')).toBe(42)
  })
  it.each([0, -3, 1.5, 'x', 2 ** 60])('rejects %s', (value) => {
    expect(Id.safeParse(value).success).toBe(false)
  })
})

describe('ProductCreate', () => {
  const valid = { name: ' Lamp ', category: 'Home & Living', price: 10 }

  it('trims, defaults images, and strips unknown fields', () => {
    const parsed = ProductCreate.parse({ ...valid, rating: 5, bestSeller: true, sellerId: 'x' })
    expect(parsed).toEqual({ name: 'Lamp', category: 'Home & Living', price: 10, images: [] })
  })
  it('treats empty original price as cleared', () => {
    expect(ProductCreate.parse({ ...valid, oldPrice: '' }).oldPrice).toBeNull()
  })
  it('requires original price above price', () => {
    expect(ProductCreate.safeParse({ ...valid, oldPrice: 10 }).success).toBe(false)
    expect(ProductCreate.safeParse({ ...valid, oldPrice: 12 }).success).toBe(true)
  })
  it('limits images to 10 https URLs', () => {
    const images = Array.from({ length: 11 }, (_, i) => `https://x.test/${i}.png`)
    expect(ProductCreate.safeParse({ ...valid, images }).success).toBe(false)
  })
  it('update is partial', () => {
    expect(ProductUpdate.parse({ price: 3 })).toEqual({ price: 3 })
  })
  it('checkOriginalPrice', () => {
    expect(checkOriginalPrice(null, 5)).toBeNull()
    expect(checkOriginalPrice(6, 5)).toBeNull()
    expect(checkOriginalPrice(5, 5)).toMatch(/higher/)
  })
})

describe('CartAdd', () => {
  it('accepts productId or the legacy product.id shape, and nothing else', () => {
    expect(CartAdd.parse({ productId: '7' })).toEqual({ productId: 7 })
    expect(CartAdd.parse({ product: { id: 7, price: 0.01 } })).toEqual({ productId: 7 })
    expect(CartAdd.safeParse({}).success).toBe(false)
  })
  it('qty is a whole number 1..99', () => {
    expect(CartQtyUpdate.safeParse({ qty: 99 }).success).toBe(true)
    expect(CartQtyUpdate.safeParse({ qty: 100 }).success).toBe(false)
    expect(CartQtyUpdate.safeParse({ qty: 1.5 }).success).toBe(false)
  })
})

describe('ProfileUpdate', () => {
  it('drops email and normalises blank text to null', () => {
    expect(ProfileUpdate.parse({ email: 'x@y.z', phone: '  ', name: ' Ama ' })).toEqual({ phone: null, name: 'Ama' })
  })
  it('only accepts https logos', () => {
    expect(ProfileUpdate.safeParse({ businessLogo: 'data:image/png;base64,AAAA' }).success).toBe(false)
    expect(ProfileUpdate.parse({ businessLogo: '' }).businessLogo).toBeNull()
  })
})

describe('MessageCreate', () => {
  it('trims the body and ignores a bad productId', () => {
    expect(MessageCreate.parse({ body: ' hi ', productId: 'junk' })).toEqual({ body: 'hi', productId: undefined })
  })
})
