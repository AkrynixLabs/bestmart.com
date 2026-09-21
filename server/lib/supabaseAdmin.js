import { createClient } from '@supabase/supabase-js'
import { getEnv } from '../config/env.js'

/** @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient */

const CLIENT_OPTIONS = { auth: { autoRefreshToken: false, persistSession: false } }

// Config is read lazily through getEnv() (first use, not import time) so a
// missing variable becomes a JSON 500 with a clear log line instead of
// crashing the serverless function at import. See config/env.js.
function readEnv() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv()
  return { supabaseUrl: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY }
}

/** @type {SupabaseClient | null} */
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
export const supabaseAdmin = /** @type {SupabaseClient} */ (
  new Proxy(
  /** @type {SupabaseClient} */ ({}),
  {
    get(_target, prop) {
      const client = getAdminClient()
      const value = Reflect.get(client, prop)
      return typeof value === 'function' ? value.bind(client) : value
    },
  }
  )
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
