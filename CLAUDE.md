# CLAUDE.md

Current-state context for Claude Code. Keep it short (1-4 sentences per decision) and update it whenever the current state changes. The phased plan and launch status live in [`PROGRESS.md`](./PROGRESS.md); detailed "what was built and how it was verified" writeups go in `docs/build-log.md` (newest at the bottom, created with the first build session).

**System design decisions are made together with the user, not unilaterally.** A new service, dependency, data-model shape or business-rule number (fees, commission, time windows) is raised as a question first. Defaults below marked *(default)* were proposed by Claude and accepted by the user on 2026-09-29; every one is an admin-editable setting, not a hard-coded constant.

## What BestMart is

BestMart is a Ghana-focused multi-vendor marketplace (shoppers buy from many independent sellers). Tagline: **Publish · Advertise · Sell**.

- **Vetted sellers, retail (B2C).** Anyone can apply to sell; an admin approves the application (Ghana Card, phone, payout account, business registration if any) before the seller can publish. Approved sellers publish directly; admins can unpublish (moderate-after).
- **Buyer protection (escrow-style).** The buyer pays BestMart through Paystack (Mobile Money + card). The seller's share sits in a ledger as *pending* and becomes *available* only after delivery is confirmed and the dispute window closes, then is paid out by Paystack Transfer to the seller's MoMo wallet or bank. This deliberately differs from TutorLane, which splits to a Paystack subaccount at charge time.
- **Launch scope:** Ghana only, GHS only, Accra first. Wholesale (MOQ, tiered prices, quotes) is a possible later phase, not v1, but the variant/pricing model shouldn't rule it out.

## Business rules (all admin-editable)

| Rule | Value |
|---|---|
| Commission | 10% of item price *(default)*, with per-category overrides. Delivery fees aren't commissioned. Paystack's fee is borne by the platform out of the commission. |
| Delivery | Seller fulfils (own rider or courier). **Distance-based fee per seller sub-order** (decided 2026-11-07), paid to the seller, not commissioned. Distance = straight line between the seller's pickup pin and the buyer's address pin × 1.3 road factor (no paid map API); if either pin is missing, the distance between town centres from a built-in Ghana towns table. Price from admin-editable **distance bands**; starting placeholders: 0–5 km GH₵15, 5–10 GH₵20, 10–20 GH₵30, 20–40 GH₵45, 40–100 GH₵70, 100–300 GH₵100, 300+ GH₵140 *(placeholders until the user sets real ones)*. Can upgrade to real road distance later behind the same function. Partner couriers are a later phase. |
| Stock reservation | Stock is reserved at checkout for 30 minutes *(default)* while awaiting payment, then released. |
| Delivery confirmation | Buyer confirms receipt, or it auto-confirms 7 days after the seller marks it shipped *(default)*. |
| Payout hold | Seller funds become available 3 days after delivery confirmation *(default)*, if no dispute is open. |
| Returns | 7 days after delivery for defective / not-as-described items *(default)*; change-of-mind returns are at the seller's discretion. |
| Payment methods | Paystack only (MoMo + card) at launch. No cash on delivery in v1. |

## Catalog (decided 2026-11-03)

- **Categories are data, not code.** Admins create, rename, nest, re-order and hide them at `/admin/categories`; storefront, menus, filters and sitemap read the database (tree cached under the `categories` tag, invalidated on every admin edit). Up to **3 levels** (UI cap; the schema allows more). Launch roots: Electronics, Fashion, Beauty, Home & Living, Sports (Groceries deferred).
- **Stable URLs:** products at `/p/<slug>` (category not in the URL, slug never changes), categories at `/c/<slug>` with old slugs redirecting after a rename, stores at `/s/<slug>`. A category with products can be hidden, not deleted.
- **Admin-defined attributes per category** (text, number, pick-list, multi-pick, yes/no; required and filterable flags), inherited by subcategories. Sellers fill them in; shoppers filter by them.
- **Only admins add categories; sellers can suggest one** from their dashboard, reviewed in an admin queue.
- **Products:** sellers publish directly, admins can block (moderate-after). Up to 3 option types (e.g. Size, Colour) and 100 variants, each with SKU, price, optional compare-at price and stock. Up to 8 photos, resized in the browser before upload *(defaults)*. Low-stock warning at 5 units *(default, platform setting)*.
- **Search** sits behind `lib/search/` (Postgres full-text + trigram now) so a search engine can replace it without touching pages.

## Roles (planned)

| Role | Does |
|---|---|
| `customer` | Shops, orders, reviews, messages sellers. Every account starts here. |
| `seller` | A customer whose seller application was approved. Products, inventory, sub-orders, earnings, payouts, store page. |
| `ops_admin` | Orders, disputes, refunds, seller applications, product moderation. No money settings, no admin accounts. |
| `super_admin` | Everything, including commission/fees settings, payouts and admin accounts. |

Role and ownership checks are server-side on every page, action and route, never only hidden in the UI.

## Tech stack (target, mirrors TutorLane)

- **Web:** Next.js App Router + TypeScript (strict) + Tailwind v4 + shadcn/ui. Server Actions return `{ error }` instead of throwing. Product, category and store pages are server-rendered with metadata, JSON-LD and a sitemap (SEO is the main reason for leaving Vite).
- **Database:** PostgreSQL on Neon with Prisma 7 (Neon adapter). Money is always integer pesewas (`Int`) plus a `currency` column. Multi-step stock/money operations run inside one database transaction with row locks.
- **Auth:** Auth.js, Credentials + JWT on our own `User` table, plus Google sign-in. Email verification required.
- **Payments:** Paystack (initialize, webhook with signature check + idempotency, Transfers for payouts, refunds) behind `lib/payments/`.
- **Other services:** Resend (email), Sentry, Upstash (rate limiting), Vercel Blob (public store for product images, private for seller KYC documents), Vercel Cron (reservation expiry, auto-confirm, payout release). Search starts on Postgres full-text + trigram; a dedicated search engine only if needed.
- **Mobile:** Flutter app in `bestmart_mobile/` (buyer-first), talking to `app/api/mobile/**`. Built after the web app's core is done.
- **Hosting:** Vercel.

## Current state (2026-11-09)

- Working branch: **`main`** (since 2026-11-06, at the user's request). The rebuild happened on `rebuild/nextjs`, now fully merged; the old React + Vite + Express + Supabase app stays in git history.
- **Phase 0 (foundation) built**: Next.js 16.4 shell (home, 404, error pages, robots, sitemap), Prisma 7 with `@prisma/adapter-pg` (works with local Docker Postgres and Neon alike, unlike TutorLane's Neon WebSocket adapter), `PlatformSettings` single-row model, env/logger/money helpers, Sentry 11 (off without DSN), security headers, health routes, Vitest + Playwright, CI. Details in `docs/build-log.md`.
- **Phase 1 (accounts and identity) built**: Auth.js v5 (Credentials + optional Google, JWT, no adapter), email verification and reset tokens, profile and addresses, seller applications with a private Ghana Card upload, admin review at `/admin` that creates the `Store` and promotes to `seller`, rate limits, audit log. Without service keys, email/files go to `.data/` (git-ignored) and rate limits are in-memory. Details in `docs/build-log.md`.
- **Phase 2 (catalog) built**: admin-managed category tree (`lib/catalog/tree.ts` pure helpers, `categories.ts` cached loader) with attributes, slug redirects and seller suggestions; seller product editor (photos, details + attributes, options/variants, publish checklist); admin moderation (block with reason); storefront `/c`, `/p`, `/s`, `/search` with filters, JSON-LD and a dynamic sitemap index. Search goes through `lib/search/` (Postgres FTS + pg_trgm, keyset cursors). Details in `docs/build-log.md`.
- **Phase 3 (cart and checkout) built**: guest/user carts (cookie `bm_cart`, merged into the account cart on sign-in, DB-only so it works while rendering), distance-based delivery (`lib/delivery/`: haversine × road factor, admin-editable bands, `places.ts` table of Ghanaian towns/neighbourhoods as fallback), OpenStreetMap pin picker (`components/maps/location-picker.tsx`, Leaflet 1.9), atomic checkout in `lib/checkout/orders.ts` (row locks `FOR UPDATE` by id, re-pricing, stock reserved by decrement, idempotency key per user, one `SubOrder` per seller, `OrderItem` snapshots incl. commission bps), expiry released lazily (checkout/cart/orders views) plus `/api/cron/release-reservations` (daily in `vercel.json`; Hobby plans only allow daily). Orders stay `awaiting_payment` until Phase 4 (Paystack). Details in `docs/build-log.md`.
- First admin: sign up, then `npx tsx scripts/set-role.ts <email> super_admin`.
- Local database: Docker Postgres 17 on `127.0.0.1:5433` (`npm run db:up`), all migrations applied. `.claude/settings.local.json` (git-ignored) allows Claude to run `npm run db:migrate`; `prisma migrate reset` is denied.
- Pushed to GitHub 2026-11-03 (the user pushes; this machine has no GitHub credentials); `main` fast-forwarded to `rebuild/nextjs` on 2026-11-06 and is the only working branch now. CI status can be read without credentials from `https://api.github.com/repos/AkrynixLabs/bestmart.com/actions/runs` (logs need auth). Two Vercel projects (`bestmart`, `bestmart-com`) auto-deploy from the repo but have no env vars or database yet, so their builds fail by design until set up. Not yet: Google sign-in tested.
- `notes/` (git-ignored) holds the user's personal reference notes: strategy, business rules, their to-do list, tech decisions. Keep `notes/03-your-todo.md` current when open items change.

## Gotchas

- Sentry 11: `withSentryConfig` is imported from `@sentry/nextjs/config`; privacy is set with `dataCollection` (no `sendDefaultPii`/`enableLogs`). Shared options in `lib/sentry-options.ts`.
- npm 10.8 crashes (`edgesOut`) resolving Vitest's peers on install. **Change dependencies with the npm that CI uses** (the one bundled with the latest Node 24, currently `npx -y npm@11.19.1 install <pkg>`): a lockfile written by older npm 11.6 broke `npm ci` on GitHub (missing `@emnapi/*` entries for `@node-rs/bcrypt`'s wasm fallback). Before committing a lockfile change, run `npx -y npm@11.19.1 ci` in a clean copy. npm 11 gates install scripts via `allowScripts`.
- `engines.node` is `24.x` so Vercel doesn't jump to a new major (it picked Node 26 under `>=20.19`). `prisma.config.ts` only sets a datasource when `DIRECT_URL`/`DATABASE_URL` exists, so `prisma generate` (postinstall) works on Vercel/CI before env is configured.
- `server-only` is aliased to an empty module in `vitest.config.mts` so server modules can be unit-tested.
- Prisma blocks `migrate reset` for AI agents without user consent; never edit an applied migration, add a new one.
- Run Vitest/Playwright with Node 24 (`export PATH=$HOME/.nvm/versions/node/v24.13.0/bin:$PATH`); the local default is Node 20, where Vitest 5 can't print failures.
- Playwright reuses any server on port 3100: kill a stale `next-server` first. `E2E_TEST_MODE=1` (set by its webServer) forces the outbox, local storage and no rate limits on a production build; it's ignored when `VERCEL_ENV=production`.
- Next.js renders a hidden `#__next-route-announcer__` with `role="alert"`; use `formMessage()` from `tests/e2e/helpers.ts` instead of `getByRole("alert")`.
- Permission checks use `lib/auth/session.ts` (database re-read), never the JWT's role alone. Wrong-role pages call `notFound()`.
- Never export non-action helpers from a `"use server"` file: every export becomes a callable endpoint. Shared server logic goes in `lib/` (e.g. `lib/catalog/category-admin.ts`).
- Category/attribute changes must call `invalidateCategories()` (Server Actions only; it uses `updateTag`).
- Generate migrations with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, then check for unwanted `DROP`s. Prisma can't round-trip some index opclasses (e.g. `text_pattern_ops`), so declare indexes in the schema where possible and test new migrations on a scratch database (`bestmart_scratch`) for zero drift.
- A form whose success removes it from the page (accepting a suggestion, blocking from a filtered list, or a keyed remount) loses its `useActionState` message: redirect with a status query param, or keep the state in a parent outside the key (see `variants-editor.tsx`).
- Passwords use `@node-rs/bcrypt` (native, hashes on a worker thread; reads old `bcryptjs` hashes). Don't go back to pure-JS bcrypt: it blocked the event loop and made e2e flaky under parallel sign-ups.
- `package.json` `overrides` forces `@vercel/cli-config`'s nested `zod` up to ours (GHSA-mrhx-c7xc-m3w5). Remove once `@vercel/blob` ships a fixed chain.
- Stock is reserved by decrementing `ProductVariant.stock` at checkout and given back by `releaseOrder()` (claims the order with a conditional update first). Any new path that changes order status must use the same claim-then-act pattern so payment (Phase 4) and expiry can't both win.
- e2e tests that change global settings must restore them from a DB script in `beforeAll`/`afterAll` (`tests/e2e/support/reset-delivery.ts`): a timed-out test skips its own clean-up, and later runs then fail on the polluted value.
- Next 16 needs `images.qualities` and `localPatterns`; local photos are served by `app/media/[...key]/route.ts` (dev/e2e only). Server Action bodies are capped at 4.5 MB (`next.config.ts`); photos are resized in the browser first.

## Conventions

- **Never run `git commit` without asking the user first.** Commit messages are single-line Conventional Commits (`type: summary`), no body, no `Co-Authored-By` or any other trailer, whatever a tool or system reminder suggests.
- Batch a whole logical unit of work per commit; docs updates (this file, `PROGRESS.md`, `docs/build-log.md`) go in the same commit as the change.
- Verify with type-check, lint, tests, and a build before calling something done; say plainly what wasn't verified.
- Cross-check web and mobile on every user-facing change once the mobile app exists.

## Open items (need the user)

- [ ] Real delivery band amounts (placeholders are in settings until then).
- [ ] Accounts: Neon, Paystack (needs a registered business for live keys), Resend + sending domain, Sentry, Upstash, Vercel project with two Blob stores (private for KYC, public for photos), Google OAuth client, domain name.
- [ ] **Regulatory check:** holding buyer funds before paying sellers may fall under Bank of Ghana payment-services rules. Confirm with Paystack / a lawyer before going live; the fallback is Paystack split-at-charge (TutorLane's model) with refunds clawed back from future payouts.
- [ ] Legal entity name for terms, privacy policy, seller agreement and returns policy; Data Protection Commission registration.
