// In-memory stand-in for the Supabase REST + Auth endpoints the API calls.
// supabase-js talks HTTP through global fetch, so intercepting fetch lets
// the real Express app (real routes, real middleware, real supabase-js
// query building) run against controllable data with no network.
//
// It implements only the PostgREST features the API actually uses: eq / in
// / or filters, order, limit, single/maybeSingle (via the Accept header),
// upsert on_conflict, and HEAD counts.

export const FAKE_URL = 'http://fake-supabase.test'

// Column defaults from supabase/migrations, applied on insert like Postgres would.
/** @type {Record<string, (now: string) => object>} */
const DEFAULTS = {
  products: () => ({ old_price: null, images: [], rating: null, is_new: false, best_seller: false }),
  conversations: (now) => ({ last_message_at: now, buyer_last_read_at: now, seller_last_read_at: now }),
  messages: () => ({ product_id: null, product_name: null }),
  orders: () => ({ status: 'Processing' }),
}

/**
 * @param {Record<string, any[]>} seed tables
 * @param {Record<string, { id: string, email: string, user_metadata?: object }>} users token -> auth user
 */
export function createFakeSupabase(seed, users) {
  const db = structuredClone(seed)
  let nextId = 5000
  const realFetch = globalThis.fetch

  /** @param {any} row @param {string} key @param {string} expr */
  const matches = (row, key, expr) => {
    const [op, ...rest] = expr.split('.')
    const v = rest.join('.')
    if (op === 'eq') return String(row[key]) === v
    if (op === 'in') return v.slice(1, -1).split(',').map((s) => s.replace(/"/g, '')).includes(String(row[key]))
    throw new Error(`fakeSupabase: unsupported operator ${op}`)
  }

  /** @param {any[]} rows @param {URLSearchParams} params */
  const filter = (rows, params) =>
    rows.filter((row) => {
      for (const [key, value] of params) {
        if (['select', 'order', 'limit', 'on_conflict', 'columns', 'offset'].includes(key)) continue
        if (key === 'or') {
          const parts = value.slice(1, -1).split(',')
          if (!parts.some((p) => { const [k, ...e] = p.split('.'); return matches(row, k, e.join('.')) })) return false
          continue
        }
        if (key.includes('.')) continue // embedded-resource filter (order_items.seller_id); ignored
        if (!matches(row, key, value)) return false
      }
      return true
    })

  const json = (body, status = 200, headers = {}) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    })

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    if (url.origin !== FAKE_URL) return realFetch(input, init)
    const method = (init.method || 'GET').toUpperCase()
    const headers = new Headers(init.headers)

    if (url.pathname === '/auth/v1/user') {
      const token = (headers.get('Authorization') || '').replace('Bearer ', '')
      const user = users[token]
      if (!user) return json({ message: 'invalid token' }, 401)
      return json({ aud: 'authenticated', user_metadata: {}, ...user })
    }

    const table = url.pathname.replace('/rest/v1/', '')
    if (!db[table]) return json({ message: `unknown table ${table}` }, 404)
    const single = (headers.get('Accept') || '').includes('vnd.pgrst.object')
    const respond = (list) => {
      const order = url.searchParams.get('order')
      if (order) {
        const [col, dir] = order.split('.')
        list = [...list].sort((a, b) => (a[col] > b[col] ? 1 : -1) * (dir === 'desc' ? -1 : 1))
      }
      const limit = url.searchParams.get('limit')
      if (limit) list = list.slice(0, Number(limit))
      if (!single) return json(list)
      if (list.length === 0) return json({ code: 'PGRST116', message: 'no rows', details: 'The result contains 0 rows' }, 406)
      return json(list[0])
    }

    if (method === 'HEAD') return json(null, 200, { 'Content-Range': `0-0/${db[table].length}` })
    if (method === 'GET') return respond(filter(db[table], url.searchParams))
    if (method === 'POST') {
      const body = JSON.parse(init.body)
      const conflict = url.searchParams.get('on_conflict')?.split(',')
      const ignore = (headers.get('Prefer') || '').includes('ignore-duplicates')
      const created = (Array.isArray(body) ? body : [body]).map((r) => {
        const existing = conflict && db[table].find((x) => conflict.every((c) => x[c] === r[c]))
        if (existing) return ignore ? existing : Object.assign(existing, r)
        const now = new Date(Date.now() - 1_000_000 + nextId).toISOString() // increasing, always in the past
        const row = { id: nextId++, created_at: now, ...(DEFAULTS[table]?.(now) ?? {}), ...r }
        db[table].push(row)
        return row
      })
      return respond(created)
    }
    if (method === 'PATCH') {
      const patch = JSON.parse(init.body)
      const hit = filter(db[table], url.searchParams)
      hit.forEach((r) => Object.assign(r, patch))
      return respond(hit)
    }
    if (method === 'DELETE') {
      const hit = new Set(filter(db[table], url.searchParams))
      db[table] = db[table].filter((r) => !hit.has(r))
      return json(null, 204)
    }
    return json({ message: 'unsupported' }, 400)
  }

  return {
    db,
    restore() {
      globalThis.fetch = realFetch
    },
  }
}
