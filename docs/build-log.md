# Build log

What was built in each session and how it was verified. Newest at the bottom.

## 2026-10-02 to 2026-10-20: Phase 0, foundation

**Replaced** the React 19 + Vite SPA, Express 5 API and Supabase migrations (no live data) with a Next.js 16 App Router app. Logos, category photos and favicons moved to `public/`. The old code is in git history before this commit.

**Built**
- Next.js 16.4 + React 19.3 + TypeScript 5.9 strict (`noUncheckedIndexedAccess`), Tailwind v4 with shadcn tokens mapped to the brand palette (navy/blue/orange), Plus Jakarta Sans.
- Storefront shell: header (search box present but disabled until Phase 2), footer, home page (hero, buyer-protection promises, category tiles, seller call-to-action), 404, error and global-error boundaries, `robots.txt`, `sitemap.xml`, Open Graph metadata.
- Prisma 7.10 with `@prisma/adapter-pg`; local Postgres 17 in Docker on port 5433. First model: `PlatformSettings` (single row) holding the agreed business-rule defaults. Migrations: `init` and `platform_settings_singleton` (CHECK id = 1 plus the default row).
- `lib/env.ts` (Zod, lazy), `lib/logger.ts` (JSON, redaction), `lib/money.ts` (pesewas formatting/parsing, basis-point commission with half-up rounding), `lib/site.ts`.
- Sentry 11 (off without a DSN; no bodies, cookies or user data), baseline security headers, `/api/health` and `/api/health/ready`.
- Vitest (23 unit tests: money, logger, env), Playwright (smoke tests on desktop and Pixel 7 viewports), GitHub Actions CI with a Postgres service.

**Verified**
- `npx tsc --noEmit`, `eslint .`: clean. `vitest run`: 23/23. `next build`: succeeds.
- Production server: `/` 200 with all security headers, `/api/health` ok, `/api/health/ready` ok against the Docker database, unknown path 404, `robots.txt` correct.
- Playwright: 6/6 (3 tests × desktop + mobile), including a no-horizontal-scroll check. Screenshots reviewed at 1366px and 390px.
- Fresh `npm ci` with npm 10.8 succeeds and generates the Prisma client.

**Not verified / notes**
- The `platform_settings_singleton` migration was written but **not applied locally**: Claude Code's auto mode blocked `prisma migrate deploy`. Run `npm run db:migrate` once. CI applies all migrations on a fresh database.
- The CI workflow hasn't run on GitHub yet (nothing pushed).
- `npm audit` reports a high-severity picomatch advisory with no fix; documented in `docs/SECURITY.md`, CI audits at `critical`.
- Not deployed to Vercel (no BestMart Vercel project yet).

## 2026-10-21 to 2026-11-02: Phase 1, accounts and identity

**Built**
- **Data model** (migration `identity_and_sellers`): `User` (role, status, optional password hash and Google id), `AuthToken` (hashed, single-use), `Address`, `SellerApplication`, `Store`, `AuditLog`, and enums for roles, the 16 regions, business types and payout methods. Hand-written SQL: emails must be stored lower-case and trimmed; at most one pending application and one default address per user (partial unique indexes).
- **Auth.js v5** with Credentials (bcrypt) and optional Google sign-in, JWT sessions, no adapter. Edge-safe `auth.config.ts` for `proxy.ts`, which redirects signed-out visitors away from `/account`, `/seller`, `/admin` and `/sell/apply`. `lib/auth/session.ts` re-reads the user from the database on every request (`requireUser`, `requireRole`, `actionUser`).
- **Account pages:** sign up, confirm email (button press), sign in, forgot/reset password, profile, change password, up to 10 delivery addresses with a default. Ghana phone numbers are normalised to `+233…`; GhanaPost GPS and Ghana Card formats are validated.
- **Selling:** `/sell/apply` (store name, business type and registration, Ghana Card number and image, phone, region, MoMo or bank payout details), status cards for pending/approved/rejected. `/admin` (ops and super admins) lists applications by status; the detail page shows the Ghana Card through `/api/admin/kyc/[id]`. Approval is a conditional update (two admins can't both decide), creates the store with a unique slug, makes the user a seller and emails them; rejection needs a reason. `/seller` is a placeholder dashboard.
- **Services:** Resend email with HTML templates (local `.data/outbox` without a key), Vercel Blob private storage (`.data/private` without a token), Upstash rate limits (in-memory without keys), audit log. `E2E_TEST_MODE` forces the local fallbacks on a production build for Playwright. Auth.js logs go through our redacting logger; failed sign-ins aren't logged as errors.
- `scripts/set-role.ts` to create the first admin. Draft Terms and Privacy pages linked from sign-up.

**Verified**
- `npm run check` (ESLint, tsc, Vitest 53/53 on Node 24) and `next build`: clean. The home page is still static.
- Playwright 17/17 on desktop and Pixel 7: signed-out redirects, generic wrong-password error, unverified accounts blocked, and a full desktop journey (sign up → confirm email → add address → apply with a Ghana Card image → customer gets 404 on `/admin` → ops admin approves → seller email → seller dashboard shows the store), plus password reset by emailed link.
- Migrations applied to the local database with `npm run db:migrate`.

**Not verified / notes**
- Google sign-in (no OAuth client yet), real Resend delivery, Vercel Blob and Upstash (no accounts yet); the local fallbacks were exercised instead.
- The rejection flow, address editing/deleting and change-password have no e2e test yet; they were checked by reading the code and types only.
- Terms and Privacy are drafts pending a lawyer and a registered company name.

## 2026-11-03 to 2026-11-06: Phase 2, catalog

**Decided with the user:** categories are admin-managed data (up to 3 levels), with admin-defined attributes per category inherited by subcategories; only admins create categories, sellers can suggest them. Launch roots: Electronics, Fashion, Beauty, Home & Living, Sports (Groceries deferred).

**Built**
- **Data model** (migration `catalog`): `Category` (tree with `path`/`depth`, status, commission override, SEO), `CategorySlugRedirect`, `CategoryAttribute`, `CategorySuggestion`, `Product` (options JSON, status, moderation fields, denormalised price range and stock, trigger-maintained `searchVector`), `ProductVariant`, `ProductImage`, `ProductAttributeValue`; `PlatformSettings.lowStockThreshold`. Hand-written SQL: `pg_trgm`, CHECK constraints (prices > 0, stock ≥ 0, was-price > price, slug and key formats, tree shape), one pending suggestion per store and name, the search trigger, and the five launch categories.
- **Category tree:** pure helpers in `lib/catalog/tree.ts` (ancestry, subtrees, visibility, inherited attributes and commission, move/depth/cycle checks, attribute-key conflicts); one cached query (`unstable_cache`, tag `categories`) invalidated by `updateTag` from every admin action.
- **Admin:** `/admin/categories` (tree with product/attribute counts; create, edit, move with subtree re-pathing, hide, delete only when empty, slug changes keep a redirect, commission editable by the Super Admin only), attributes (type locked once used, in-use choices can't be removed), `/admin/category-suggestions` (accept creates the category; seller emailed either way), `/admin/products` (block/unblock with reason; seller emailed). All audit-logged.
- **Seller:** dashboard with counts and low-stock list; `/seller/products` (tabs, search); product editor with photos (resized in the browser to 1600 px JPEG, up to 8, reorder, delete), details and attribute inputs, options/variants editor (up to 3 options, 100 variants, regenerate keeps existing rows, two-pass save so SKUs can swap), category change, publish checklist; `/seller/categories` suggestions.
- **Storefront:** `/c/[slug]` (subcategory chips, filters for price and filterable attributes as a GET form, old slugs 301), `/p/[slug]` (gallery, variant picker with per-combination price/stock, specs, Product + Breadcrumb JSON-LD; owner/admin preview with noindex, 404 for everyone else), `/s/[slug]`, `/search` (products + matching sellers), live header search, home page categories and new arrivals from the database. Filtered/paged views are `noindex, follow` with canonical URLs.
- **Search:** `lib/search/` interface with a Postgres implementation (`websearch_to_tsquery` + `word_similarity`), keyset cursors for browse sorts, capped pages for relevance.
- **Sitemap:** `/sitemap.xml` index plus `/sitemaps/pages.xml` and `/sitemaps/products-N.xml` (10,000 per file), built on request.
- **Uploads:** shared magic-byte checks (`lib/validation/files.ts`); public Blob store (`PUBLIC_BLOB_READ_WRITE_TOKEN`) or `.data/public` served at `/media/*` locally; Server Action body limit 4.5 MB.
- **Phase 1 fix:** Ghana Card uploads over 1 MB failed (Next's default Server Action limit). Photos are now shrunk in the browser; limit 4 MB.

**Verified**
- `npm run check`: ESLint, tsc, Vitest 78/78. `next build` clean (no whole-project tracing warning).
- Migration chain applied to a scratch database with zero Prisma drift, then to the local database.
- Playwright 26/26, two consecutive cold runs: the full catalog journey on desktop (admin creates a subcategory and required attribute → visible on the storefront immediately → seller lists a product, uploads a 2400 px photo that arrives as a 1600 px JPEG, fills the attribute, adds 2 storage variants, publishes → shopper finds it by category, parent category, attribute filter and typo-tolerant search, switches variant price/stock → seller suggestion accepted and emailed → category slug change redirects with query → admin blocks: product 404s for shoppers, seller sees the reason and gets an email → sitemaps list the categories), plus a phone-width overflow check of catalog pages.
- Screenshots of home, category, product and search pages reviewed at 1366 px and Pixel 7.

**Not verified / notes**
- Real Vercel Blob uploads (no account); the local store was exercised.
- Not covered by e2e yet: deleting/moving categories with subcategories, deleting attributes with values, archive/restore, photo reordering and deletion, unblock.
- The first e2e run after a server start was flaky until the expect timeout went to 10 s: `bcryptjs` hashing blocks the event loop. A native bcrypt is an open decision.
- Rating filter and sort wait for reviews (Phase 7). Store name search uses `ILIKE` (fine at current scale).

## 2026-11-06: Native password hashing

**Changed** `bcryptjs` (pure JavaScript) to `@node-rs/bcrypt` (Rust via N-API). Each cost-12 hash used to block the Node event loop for roughly 0.3 s, so concurrent sign-ups/sign-ins delayed every other request (it showed up as flaky first-run e2e tests). Hashes now run on libuv worker threads; the hash format is unchanged.

Also added an npm `overrides` entry so `@vercel/cli-config`'s nested `zod` uses our patched version (GHSA-mrhx-c7xc-m3w5).

**Verified**
- A password hash created earlier by `bcryptjs` verifies with the new library (wrong password rejected). 8 parallel cost-12 hashes: ~0.5 s total.
- `npm run check` (Vitest 78/78), `next build`, and Playwright 26/26 on two cold runs **at the default 5 s expect timeout** (the 10 s workaround was removed); the suite went from ~53 s to ~33 s.
- `npm audit --omit=dev`: 0 critical; only the documented picomatch exception remains at high.

## 2026-11-06: CI and Vercel install fixes

**Problem:** after pushing `main`, GitHub CI failed at `npm ci` and both Vercel projects failed at install.
- CI runs the latest Node 24 (24.22.3, npm 11.19.1). That npm rejected the lockfile written by npm 11.6.2: `Missing: @emnapi/runtime@1.11.3, @emnapi/core@2.0.0-beta.2` (dependencies of `@node-rs/bcrypt`'s wasm fallback).
- Vercel has no environment variables yet, and `prisma.config.ts` required `DIRECT_URL`, so `postinstall: prisma generate` aborted. Vercel also chose Node 26 because of `engines: >=20.19`.

**Fixed:** regenerated the lockfile with npm 11.19.1; `prisma.config.ts` sets the datasource only when a URL exists; `engines.node` is `24.x`.

**Verified:** clean `npm ci` with **no database env** on npm 11.19.1, 11.6.2 and 10.9.2 (Prisma client generated each time); `npm run check` (78/78), `next build`, Playwright 26/26. A build with no env at all now stops with a clear "Invalid environment configuration" list (intended: Vercel needs `DATABASE_URL`, `AUTH_SECRET` and the rest before it can deploy).

## 2026-11-07: Phase 3, cart and checkout

**Decided with the user:** delivery fees by distance (no paid map API: straight line between pins × 1.3, town-centre estimate when a pin is missing) priced by admin-editable distance bands with placeholder amounts; pins set on an OpenStreetMap map (Leaflet); an account is required to check out (browsing and the cart work signed out). Work moved to `main`.

**Built**
- **Data model** (migration `cart_and_orders`): map pins on `Address`, pickup area/pin on `Store`, `PlatformSettings.deliveryBands` (JSON) and `deliveryRoadFactorPct`, `Cart`/`CartItem`, `Order` (address snapshot, totals, `reservedUntil`, per-user idempotency key), `SubOrder` (per seller: items total, delivery fee, km, distance source), `OrderItem` (title/options/SKU/price/image snapshot plus commission bps). Hand-written CHECKs: pins in range and paired, cart has exactly one owner, quantities 1–99, totals add up (`grandTotal = itemsTotal + deliveryTotal`, `lineTotal = unitPrice × quantity`), road factor 100–300 %.
- **Delivery** (`lib/delivery/`): haversine distance, band lookup with validation and a safe fallback, location resolution pin → neighbourhood → town → regional capital (whole-word, longest-name matching over ~100 places), quote source = the weaker end, shopper wording ("about 11 km, estimated between neighbourhoods").
- **Maps:** `LocationPicker` (Leaflet loaded client-side, OSM tiles with attribution, tap to place, drag to adjust, "Use my location", remove pin; hidden lat/lng inputs; CSS pin, no image assets). Used in the address form (with a safe `returnTo=/checkout`) and the new seller **Pickup location** page. Pins are validated to lie inside Ghana.
- **Cart:** guest cookie (`bm_cart`, httpOnly, random 24-byte token), merged into the account cart on the first request after sign-in; live availability/stock per line; quantities capped at stock and 20; header badge via `/api/cart`; "Add to cart" with quantity on product pages; sellers can't add their own products.
- **Checkout** (`lib/checkout/orders.ts`): idempotent `placeOrder` locks variant rows in id order (`SELECT … FOR UPDATE`), re-checks availability, stock and own-store, re-prices, quotes delivery per seller, writes order + sub-orders + items, decrements stock, re-syncs product aggregates and clears the bought lines, all in one transaction. `releaseOrder` claims an unpaid order with a conditional update before returning stock (expiry or cancel).
- **Pages:** `/cart`, `/checkout` (address picker, per-seller delivery with distance wording, total on the button), `/orders` and `/orders/[number]` (owner-only, countdown, cancel with a page-level confirmation), `/seller/settings`, `/admin/settings` (Super Admin only: bands editor, road factor, worked examples; audit-logged). Account menu and account sidebar link to Orders; `/checkout` and `/orders` require sign-in in `proxy.ts`.
- **Expiry:** released before every checkout and when carts/orders are viewed; `/api/cron/release-reservations` (bearer `CRON_SECRET`, constant-time compare) scheduled daily in `vercel.json` (Vercel Hobby only allows daily crons; on Pro, run it every 5–15 minutes).

**Verified**
- `npm run check`: ESLint, tsc, Vitest 92/92 (14 new: distance, bands, place matching incl. whole-word cases, quote sources, cart rules, order numbers, pin validation). `next build` clean.
- Migration chain on a scratch database: zero drift; then applied locally with `npm run db:migrate`.
- Playwright 33/33 on two consecutive full runs. New desktop journey: seller sets a pickup area and lists a product (stock 3) and can't buy it → guest adds 2, the badge shows 2, over-stock is refused → checkout redirects to sign-in, sign-up keeps the guest cart → address saved with "Use my location" (mocked geolocation) → "about 11 km, estimated between neighbourhoods", total GH₵120 (2 × 45 + 30) → order placed, stock drops to 1 → cancel restores 3 → a second order expires via the cron route and restores stock → Super Admin changes band 3 to GH₵35 and the next checkout totals GH₵80 → another user gets 404 for the order, an ops admin gets 404 for settings. The phone-width check now includes `/cart`.

**Not verified / notes**
- No payment yet: orders stay "awaiting payment" until Phase 4.
- Concurrency (two buyers racing for the last item) relies on the row locks; not load-tested yet (Phase 9).
- The map itself (tile loading, dragging) isn't exercised by e2e; the "Use my location" path is.
- Place coordinates are approximate (about 1 km); they only matter when a pin is missing.
- Twice, during development, an earlier version of the band-change test hit the generic error page on the login screen with nothing in the server log. *Root-caused in Phase 4a: see that entry (proxy redirecting a Server Action POST).*
- A test that changed the bands once left them modified after failing. Tests now reset delivery settings from a DB script before and after the suite.

## 2026-11-08 to 2026-11-09: Phase 4a, payments, commission, ledger and refunds

**Decided with the user:** escrow-style money flow with funds kept in BestMart's Paystack balance (the user is confirming with Paystack that this is allowed; fallback is split-at-payment with the same ledger); weekly payout batches approved by the Super Admin; payouts built after Phase 5; development uses a local Paystack stand-in until test keys arrive.

**Built**
- **Data model** (migration `payments_and_ledger`): `Payment` (one per attempt, unique reference, provider fee), `WebhookEvent` (unique per provider + dedupe key), `Refund` (items/delivery/commission split, provider id, automatic flag), `LedgerEntry` (signed pesewas, kind, pending/available bucket), `refunded` order/sub-order status, `refundedTotal`, `SubOrder.commissionTotal`/`paidAt`. CHECKs: amounts positive, refund parts add up, refunds ≤ paid, commission ≤ items, ledger sign matches kind; partial unique index: at most one succeeded payment per order.
- **Provider layer** (`lib/payments/`): interface (initialize, verify, refund, verifySignature); Paystack REST client (GHS in pesewas, MoMo + card channels, 20 s timeouts); local stand-in (JSON files in `.data/fake-payments/`, `/dev/paystack/[reference]` approve/decline page that sends a signed `charge.success` webhook to our endpoint, 404 whenever real keys are configured). Pure rules (`rules.ts`): per-line commission, sale entries, refund split, references, webhook keys.
- **Flow:** "Pay GH₵…" on the order page → hosted checkout → return page asks the provider for the truth → webhook does the same independently. `confirmPayment` is idempotent; claims the payment then the order (`awaiting_payment → paid`); a late payment (order expired/cancelled) re-reserves stock under row locks or is refunded in full automatically; a second successful payment for a paid order is refunded and recorded as such; amount/currency mismatches are never fulfilled. On success: sub-orders paid, commission frozen, seller ledger credited (pending), buyer and seller emailed.
- **Refunds:** `issueRefund` locks the sub-order row, splits the amount (items first, then delivery; commission returned proportionally and cumulatively so partial refunds don't drift), reserves it, calls the provider, then writes ledger entries (same bucket as the sale; may go negative once available) and statuses; `refund.processed`/`refund.failed` webhooks finish pending ones; failures release the reservation. Buyer emailed; audit-logged.
- **Pages:** order page Pay button, payment banners and refunds; `/admin/orders` (views, search) and `/admin/orders/[number]` (items with commission rates, seller ledger per part, payments with fees, refunds, refund form for ops and super admins); `/seller/earnings` (pending/available balances, activity).

**Root-caused the login error page.** The proxy redirected signed-in users away from `/login`, including the sign-in form's Server Action POST. In tests, the previous page's `/api/auth/session` refresh rewrote the session cookie after `clearCookies()`; for real users, the same happens when they sign in in another tab and then submit the form. The client got an HTML redirect instead of an action response ("An unexpected response was received from the server"). The proxy now only redirects GET/HEAD; a new e2e test (two tabs) fails on the old proxy and passes on the new one. Also added `/checkout` and `/orders` to the proxy matcher (they were protected by page-level checks only).

**Also fixed a test-helper race:** `logOut()` cleared cookies while the previous page could still be refreshing the session, which sometimes re-set the cookie (a "signed-out" shopper still saw an admin preview, or `/login` redirected away). It now leaves the page before clearing cookies. Journey suites allow 90 s per step.

**Verified**
- Full Playwright suite 41/41 on three consecutive runs; `npm run check` with Vitest 101/101; `next build` clean.
- Vitest: 9 new tests (commission rounding, ledger entries, refund splits incl. no-drift over three partial refunds and over-refund rejection, HMAC signatures, dedupe keys).
- Migration chain on a scratch database: zero drift; applied locally.
- Payments e2e (desktop, against the stand-in): declined payment changes nothing → approved payment marks the order paid and emails buyer and seller → seller earnings show GH₵111.00 pending (90 − 9 + 30) → a replayed signed webhook returns `duplicate` and changes nothing; a forged one gets 401 → admin refunds GH₵45 (commission GH₵4.50 returned; earnings GH₵70.50; buyer sees −GH₵45; over-refund refused) → paying after the hold expired re-reserves the stock → paying after it expired *and* the stock was sold refunds in full automatically.

**Not verified / notes**
- Real Paystack (no keys yet): request/response shapes follow Paystack's documented API, but haven't been exercised against their test environment. To do as soon as the user sends `sk_test_…`.
- Refund webhooks (`refund.processed`/`failed`) are handled but untested end to end: the stand-in completes refunds immediately.
- Paystack's fee is recorded per payment; platform revenue reports come with the admin phase.

## 2026-11-10 to 2026-11-11: Phase 5, fulfilment

**Decided with the user:** sellers ship within 3 days of payment (setting), after which the buyer can cancel that part for a full refund; marking shipped needs the method, the rider/courier name and the rider's phone or a tracking number; problem reports can include up to 3 private photos.

**Built**
- **Data model** (migration `fulfilment`): sub-order statuses `processing`, `shipped`, `delivered`, `completed`; fulfilment fields on `SubOrder` (`shipBy`, `acceptedAt`, `shippedAt`, method, carrier, rider phone, tracking, `deliveredAt`, `confirmedBy`, `completedAt`, `overdueNotifiedAt`); `SubOrderEvent`, `Dispute` (+ `DisputeAttachment`), `EmailOutbox`; `PlatformSettings.shipWithinDays`. CHECKs: shipping details complete when shipped; resolved disputes have an outcome; one open dispute per sub-order (partial unique index).
- **Rules and service:** pure state machine, deadlines and reportable reasons; `transition()` for every change; accept, ship, confirm, auto-confirm, release (ledger pending → available), cancel with restock + full refund (seller any time before shipping, buyer after the deadline), disputes (open with photos, seller response, admin resolution via `issueRefund`, two-admin race guarded by claiming the dispute first), overdue notices. Payment confirmation now sets `shipBy` and records the first event; refunds that finish a part record it too.
- **Outbox:** emails enqueued in the same transaction, flushed right after and by the daily job; claimed before sending; backoff 1, 5, 25, 125… minutes, gives up after 6 attempts.
- **Pages:** `/seller/orders` (tabs, late and problem badges) and `/seller/orders/[id]` (buyer contact and map pin, accept, ship form, cancel, dispute response, earnings breakdown, history); buyer order page per-part status, rider/courier details, "I received it", "Cancel this part", "Report a problem", history; `/orders/[number]/problem`; `/admin/disputes` and dispute panels with photos and a resolve form on `/admin/orders/[number]`; admin overview counts problems and late shipments; seller dashboard shows orders to ship. `/api/cron/daily` runs every time-based job (the schedule in `vercel.json` now points to it).
- **Lost-confirmation fixes:** status-changing actions (accept, ship, seller cancel, confirm, buyer cancel, resolve, refund) redirect to a page-level banner instead of returning a message from a form that disappears.

**Verified**
- `npm run check` (Vitest 106/106; 5 new: state machine permissions, deadlines, reportable reasons, backoff), `next build` clean, migration zero drift.
- Playwright 47/47 on two consecutive full runs. New fulfilment journey (desktop): accept → ship (rider phone required) → buyer sees the rider and confirms → after the hold (time-travelled), GH₵70.50 available and "Earnings released" in the history → an unconfirmed shipment auto-confirms after 7 days → a "faulty" report with a photo freezes release past the hold; the seller responds; the admin sees the photo and refunds GH₵20 (GH₵2 commission returned) → release goes ahead (GH₵123.00 available) → a late shipment triggers the overdue email and the buyer cancels for a refund (stock returns) → a seller cancellation refunds the buyer.
- Test isolation: the delivery-band test moved to `tests/e2e/settings.spec.ts` in its own Playwright project that runs after everything else (it had changed a fee under a parallel suite); job tests assert outcomes, not counts.

**Not verified / notes**
- SMS notifications: later. Email delivery itself is still the local outbox until Resend is configured.
- Admin "mark delivered" override and returns logistics (who ships the item back) are handled outside the system for now; the admin decides refunds.

