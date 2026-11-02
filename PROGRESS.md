# BestMart — Plan & Progress

A plain-language view of the rebuild, phase by phase. Current state and open decisions are in [`CLAUDE.md`](./CLAUDE.md). `[x]` means built **and** verified.

The rebuild happens on the `rebuild/nextjs` branch. Each phase ends in a working, deployable state, and is merged when the user is happy with it.

## Phase 0 — Foundation ✅ (built 2026-10-20; CI not yet run on GitHub)
- [x] Next.js App Router + TypeScript strict + Tailwind v4 + shadcn/ui, BestMart brand tokens, logo, photos
- [x] Prisma 7 (local Docker Postgres now, Neon later), env validation, Sentry, structured logging, security headers
- [x] ESLint, Vitest, Playwright, GitHub Actions CI (lint, type-check, migrations, test, build, e2e, audit)
- [x] Remove the Vite SPA, Express API and Supabase code; update README and docs

## Phase 1 — Accounts and identity ✅ (built 2026-11-02; Google sign-in untested until an OAuth client exists)
- [x] Auth.js: email + password (verification, reset) and Google sign-in; Resend email templates
- [x] Roles (`customer`, `seller`, `ops_admin`, `super_admin`) with server-side guards
- [x] Profile and saved addresses (region, city, area, landmark, GhanaPost GPS digital address, phone)
- [x] Seller application (store name, Ghana Card, phone, payout account; document upload to private Blob) → admin approval
- [x] Rate limiting (Upstash) on auth and sensitive actions; audit log table

## Phase 2 — Catalog
- [ ] Category tree in the database, seed data
- [ ] Products with variants (SKU, price in pesewas, compare-at price, stock), image upload
- [ ] Product detail, category and seller store pages, server-rendered, with SEO metadata, JSON-LD and sitemap
- [ ] Search (Postgres full-text + trigram), filters (category, price, rating), sorting
- [ ] Seller dashboard: products and inventory, low-stock flags

## Phase 3 — Cart and checkout
- [ ] Cart for guests (cookie) merged into the account on login
- [ ] Delivery zones and fees (admin settings), address selection
- [ ] Atomic checkout: re-price, reserve stock with row locks, create the order plus one sub-order per seller (`awaiting_payment`)
- [ ] Reservation expiry job (Vercel Cron)

## Phase 4 — Payments and money
- [ ] Paystack payment (MoMo + card); webhook with signature check, verification and idempotency
- [ ] Commission per line (category override aware); seller ledger (pending → available)
- [ ] Payouts by Paystack Transfer to seller MoMo / bank; payout history
- [ ] Refunds (full and partial), clawback from the seller ledger

## Phase 5 — Fulfilment
- [ ] Sub-order state machine with status history: paid → processing → shipped → delivered → completed (plus cancelled, refunded, disputed)
- [ ] Buyer confirms receipt; auto-confirm after the window; payout release job
- [ ] Returns and disputes, handled in the admin area
- [ ] Order emails (placed, paid, shipped, delivered) via an outbox; SMS later

## Phase 6 — Admin
- [ ] Seller applications, product moderation, orders, disputes, refunds, payouts
- [ ] Settings: commission, category overrides, delivery fees, time windows
- [ ] Reports (sales, commission, top sellers) and audit log viewer

## Phase 7 — Engagement
- [ ] Verified-purchase reviews and ratings
- [ ] Wishlist
- [ ] Buyer ↔ seller messaging (tied to a product or order)
- [ ] Coupons (platform-wide and seller-scoped)
- [ ] Seller ads / promoted listings (the "Advertise" in the tagline)

## Phase 8 — Mobile
- [ ] `app/api/mobile/**` with bearer tokens (same pattern as TutorLane)
- [ ] Flutter buyer app `bestmart_mobile/`: browse, search, product, cart, checkout (Paystack in a webview), orders, messages, push notifications
- [ ] Seller basics in the app (orders, mark shipped), CI build and signing

## Phase 9 — Launch readiness
- [ ] Playwright journeys for every role; load test checkout
- [ ] Legal: terms, privacy, seller agreement, returns policy
- [ ] Own accounts and domain, production env, backups and rollback runbook, monitoring alerts
- [ ] First real payment and payout test

## Log

- **2026-09-29** — Plan agreed in principle: rebuild on TutorLane's stack, vetted B2C marketplace with escrow-style payouts, Ghana/GHS first, Flutter app after the web core. Awaiting go-ahead on this plan.
- **2026-10-20** — Phase 0 done: the old app is replaced by a Next.js storefront shell (home page, error pages, health checks) with a database, tests on desktop and mobile sizes, and CI. Next: Phase 1, accounts and seller applications.
- **2026-11-02** — Phase 1 done: people can create accounts (email confirmation, password reset, Google once configured), save delivery addresses, and apply to sell; admins review applications, see the Ghana Card privately, and approval creates the store. Next: Phase 2, the catalog.
