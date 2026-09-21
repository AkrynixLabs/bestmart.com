// Minimal diagnostic endpoint: no Express, no Supabase, no dependencies.
// Checks that a plain Vercel function invokes at all and can see its env
// vars. If this works but /api/products doesn't, the problem is in
// server/app.js's dependency chain, not Vercel's function setup. Deep checks
// (config + database) live at /api/health/ready.
/**
 * @param {import('node:http').IncomingMessage} _req
 * @param {import('node:http').ServerResponse} res
 */
export default function handler(_req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(
    JSON.stringify({
      ok: true,
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      nodeVersion: process.version,
    })
  )
}
