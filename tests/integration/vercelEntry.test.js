// The Vercel function (api/index.js) receives either the original URL or the
// rewritten one (/api?__path=...), depending on platform behaviour. Both must
// reach the same Express route.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { createFakeSupabase } from '../helpers/fakeSupabase.js'

let fake
let server
beforeAll(async () => {
  fake = createFakeSupabase({ products: [] }, {})
  const { default: handler } = await import('../../api/index.js')
  server = http.createServer(handler)
})
afterAll(() => fake.restore())

describe('api/index.js', () => {
  it.each([
    ['/api/v1/products', 200],
    ['/api?__path=v1/products', 200],
    ['/api?__path=products', 200],
    ['/api/products?__path=products', 200],
    ['/api?__path=v1/nope', 404],
  ])('%s -> %i', async (url, status) => {
    const res = await request(server).get(url)
    expect(res.status).toBe(status)
  })
})
