# Security

How BestMart protects accounts, money, and data, which controls are in place
today, and which are planned. Report vulnerabilities privately to the
maintainers instead of opening a public issue.

## Trust boundaries

1. **The browser is untrusted.** It may send any body, header, or id. The
   API derives identity from the verified JWT, prices from the database, and
   seller attribution from the product row.
2. **The Express API is the only writer.** It uses the Supabase service-role
   key, so every route must authenticate and authorize explicitly.
3. **Row-level security is defence in depth.** Clients keep read access that
   Realtime needs. Since migration 007, they have no write policies.

## Controls in place

| Area | Control | Where |
|---|---|---|
| Authentication | Supabase Auth (hashed passwords, short-lived JWT + refresh rotation, single-use reset links). Every API request verifies the bearer token with Supabase. | `server/middleware/auth.js` |
| Authorization | Seller-only routes (`sellerOnly`); ownership checks on products, cart lines, conversations, and seller orders. Non-participants get 404 for threads. | routes |
| Pricing integrity | Cart and checkout look up price and seller server-side; client values are ignored; checkout re-prices every line. | `server/lib/catalog.js`, `routes/checkout.js` |
| Input validation | Zod schemas on every write; unknown fields stripped; platform-controlled fields (rating, badges, email) not writable. | `shared/schemas/`, `server/common/validate.js` |
| Uploads | JPEG/PNG/WebP/GIF only, 3MB, one file, server-chosen path under the uploader's folder. | `server/lib/imageUpload.js` |
| Request limits | JSON bodies ≤100KB; rate limits on checkout, messaging, uploads. | `server/app.js`, `server/common/rateLimit.js` |
| Headers | helmet: `nosniff`, `frame-ancestors 'none'`, strict CSP for API responses, `Cache-Control: no-store`, no `X-Powered-By`. | `server/app.js` |
| CORS | Same-origin by default; extra origins only via `CORS_ORIGINS`. | `server/app.js` |
| Error handling | Uniform `{error, code, requestId}`; database messages are logged, never returned. | `server/common/errors.js` |
| Logging | Structured JSON with request ids; keys matching tokens, passwords, secrets, keys, or card data are redacted. Bodies are never logged. | `server/common/logger.js` |
| Secrets | Env vars only; service-role key never `VITE_`-prefixed; `.env` git-ignored. | `.env.example` |
| Supply chain | `npm audit` in CI (runtime deps, high+). | `.github/workflows/ci.yml` |

## Known gaps (tracked in DEVELOPMENT_CHECKLIST.md)

- **Rate limits are per serverless instance** (in-memory). A shared store
  (Upstash Redis or Postgres) is needed for a global guarantee.
- **No RBAC yet.** "Seller" is a boolean any user can set on their own
  profile; seller approval and admin roles arrive in Phase 3.
- **Checkout is not a single transaction** and has no stock reservation or
  payment verification yet (Phases 5–6).
- **Mixed-seller orders share one status**, so any seller on an order can
  advance it (Phase 6: per-seller sub-orders).
- **No audit log** of sensitive actions yet (Phase 3).
- **Supabase Storage bucket is public-read** (product images are public by
  nature; never store private documents there).

## Payment security (design for Phase 6)

- Hosted Paystack checkout: card numbers and CVVs never touch our servers.
- An order becomes `paid` **only** from a verified webhook: HMAC-SHA512
  signature check, then server-to-server transaction verification, then
  amount and currency compared to the stored order.
- Webhook events stored with a unique provider event id, so duplicates are
  processed once.
- Idempotency keys on payment initiation; append-only payment history.

## Operational practices

- Separate Supabase projects for development, preview, and production.
- Rotate the service-role key if it is ever exposed; it bypasses RLS.
- Supabase daily backups; enable point-in-time recovery for production.
- Never paste production data into issues, logs, or AI tools.
