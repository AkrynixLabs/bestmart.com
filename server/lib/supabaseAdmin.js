import { createClient } from '@supabase/supabase-js'

const CLIENT_OPTIONS = { auth: { autoRefreshToken: false, persistSession: false } }

// Read lazily (at first use, not at import time). Throwing at import time
// crashes the whole serverless function before Express can respond, which
// Vercel reports only as an opaque FUNCTION_INVOCATION_FAILED. Throwing on
// first use instead lands in Express's error handler as a normal JSON 500,
// and the message shows up in the function logs.
function readEnv() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing server env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        '(Supabase Dashboard -> Project Settings -> API) — see .env.example.'
    )
  }
  return { supabaseUrl, serviceRoleKey }
}

let adminClient = null
function getAdminClient() {
  if (!adminClient) {
    const { supabaseUrl, serviceRoleKey } = readEnv()
    adminClient = createClient(supabaseUrl, serviceRoleKey, CLIENT_OPTIONS)
  }
  return adminClient
}

// Service-role client: bypasses RLS entirely. This is safe ONLY because
// every route that uses it goes through the authenticate/requireSeller
// middleware first — Express is the enforcement point for this whole API.
// Never import this file from src/.
//
// Exposed through a Proxy so callers keep writing `supabaseAdmin.from(...)`
// while the real client is created on first use (see readEnv above).
//
// Used for plain data queries (.from(...)) only — NOT for .auth.getUser(),
// which needs a fresh client per call (see createAuthClient below).
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getAdminClient()
      const value = client[prop]
      return typeof value === 'function' ? value.bind(client) : value
    },
  }
)

// A fresh, throwaway client for verifying one request's token via
// auth.getUser(token) in the `authenticate` middleware. Supabase's auth
// client holds internal state/locking built around a single current
// session; reusing one shared client instance to validate many different
// users' tokens concurrently can contend on that lock and stall. A new
// client per call has no shared state to contend over — cheap, since it
// does no network I/O until first used.
export function createAuthClient() {
  const { supabaseUrl, serviceRoleKey } = readEnv()
  return createClient(supabaseUrl, serviceRoleKey, CLIENT_OPTIONS)
}
