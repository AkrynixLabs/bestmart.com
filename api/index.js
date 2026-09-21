import app from '../server/app.js'

// Vercel serverless entry point for the whole API. vercel.json rewrites
// every /api/* request here (files that exist on their own, like
// api/health.js, are served directly instead) and passes the original
// sub-path along as ?__path=, so Express's own router (the mounted paths in
// server/app.js) can do the real routing whether Vercel hands this function
// the original URL or the rewritten one.
/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export default function handler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const originalPath = url.searchParams.get('__path')
  if (originalPath !== null) {
    url.searchParams.delete('__path')
    if (!url.pathname.startsWith('/api/')) url.pathname = `/api/${originalPath}`
    req.url = url.pathname + url.search
  }
  return app(req, res)
}
