# Security

## In place (Phase 0-4a)

- **Security headers** on every response (`next.config.ts`): HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` removed.
- **Validated configuration** (`lib/env.ts`); secrets are server-only (`server-only` import guard). Only `NEXT_PUBLIC_*` values reach the browser.
- **Log redaction** of tokens, passwords, cookies, keys and ID numbers (`lib/logger.ts`).
- **Sentry privacy:** no request bodies, cookies or automatic user data.
- **Health endpoints** don't leak error details.
- **CI dependency audit** on runtime dependencies.
- **Passwords:** bcrypt (cost 12, native `@node-rs/bcrypt` on a worker thread so hashing can't stall other requests), minimum 8 characters with a letter and a number. Unknown emails still run a dummy hash so response time doesn't reveal which accounts exist.
- **No account enumeration:** sign-up, sign-in, resend-verification and forgot-password give the same response whether or not the email is registered (an existing account gets an email instead). Suspended/unverified status is only revealed after a correct password.
- **Tokens:** email-verification (24 h) and reset (1 h) tokens are random, stored only as SHA-256 hashes, single-use (consumed atomically), and issuing a new one invalidates older ones. Verification needs a button press, so link scanners can't consume it.
- **Sessions:** Auth.js JWT cookies, but every page, action and route re-reads role and status from the database, so suspensions and role changes apply immediately. `/admin` returns 404 to non-admins. Sign-in `callbackUrl` only accepts same-site paths.
- **Rate limits** (Upstash, in-memory fallback in development): sign-in per IP and per email, sign-up, forgot-password, resend-verification, change-password, seller applications.
- **Seller KYC:** Ghana Card images are type-checked by their content, not the file name (JPEG, PNG, WebP or PDF, max 5 MB), stored in a **private** Blob store under random keys, and served only through an admin-only route with `no-store` and a sandbox CSP; every view is audit-logged.
- **Audit log** for role changes, application decisions, KYC document views, category/attribute changes, suggestion decisions and product blocks.
- **Catalog uploads:** product and category photos are checked by content (JPEG/PNG/WebP), stored under random keys in a separate public store, limited to 8 per product and rate-limited per store. Browser-side resizing also drops photo metadata such as GPS location.
- **Catalog authorization:** every seller action loads the product by id *and* the seller's store, so one seller can never read or change another's products; suspended stores can't edit. Drafts, blocked products and hidden categories return 404 to shoppers; only the owner and admins get a `noindex` preview. Commission overrides are Super Admin only.
- **Checkout integrity:** prices, stock, availability and delivery fees are recomputed on the server inside the order transaction (variant rows locked); the browser only chooses an address it owns and sends an idempotency key, so a tampered form or a double-click can't change prices or create duplicate orders. Orders and addresses are always looked up with the owner in the query (another user's order number is a 404).
- **Guest cart cookie:** random 24-byte token, httpOnly, SameSite=Lax, Secure in production; it only identifies a cart (no personal data).
- **Delivery settings** are Super Admin only and audit-logged with before/after values; the cron route requires `CRON_SECRET` in production (constant-time comparison).
- **Location data:** map pins are optional, validated to lie inside Ghana, and stored only on the user's own addresses and orders.
- **Payments:** card and MoMo details are entered only on Paystack's hosted page. Webhooks must carry a valid HMAC-SHA512 signature, are recorded and de-duplicated before processing, and never decide anything alone: every payment is re-verified with Paystack's API, and the amount and currency must match the order exactly. A browser return URL proves nothing; it only triggers the same verification. Status changes use conditional updates, and a partial unique index allows only one successful payment per order (duplicates are refunded).
- **Refunds** are admin-only (ops and super admins), row-locked against concurrent over-refunds, capped by database constraints, emailed to the buyer and audit-logged.
- **Payment stand-in** (`/dev/paystack/*`) exists only when no Paystack key is configured outside production (or in e2e); it returns 404 otherwise.
- **Proxy** redirects only GET/HEAD requests, so Server Action submissions are never answered with an HTML redirect.
- **Search input** is length-capped and passed as bound parameters (`Prisma.sql`), never concatenated into SQL. JSON-LD escapes `<`.
- **Test mode guard:** `E2E_TEST_MODE=1` (local outbox, local storage, no rate limits) is ignored when `VERCEL_ENV=production`, and production without Resend/Blob keys refuses to start those features rather than silently falling back.

## Planned

| Phase | Control |
|---|---|
| 4 | Strict Content-Security-Policy with nonces (Paystack, Sentry and `tile.openstreetmap.org` image origins) |
| 4b | Restrict the webhook route to Paystack's published IP addresses as defence in depth |
| 6 | Admin audit log viewer; two-factor sign-in for admin accounts (proposed) |
| 9 | Pre-launch review: OWASP checklist, dependency review, backup/restore drill |

## Known exceptions

- **picomatch ReDoS advisory (GHSA-fc5q-39xc-vjpf), high, no fixed version (2026-10-20).** It comes in through `@sentry/nextjs` (its build-time Rollup plugin) and Vite/Vitest. picomatch only matches file globs from our own config during builds and tests; no user input reaches it, so it isn't exploitable here. CI audits at `critical` until a fixed version exists; then return to `high`.

- **zod advisory (GHSA-mrhx-c7xc-m3w5), high (2026-11-06).** Our own `zod` is fixed (4.6.7); an old copy nested under `@vercel/blob` → `@vercel/oidc` → `@vercel/cli-config` is forced to the same version with an npm `overrides` entry. Drop the override when upstream updates.

## Reporting

Report suspected vulnerabilities privately to the maintainer rather than opening a public issue.
