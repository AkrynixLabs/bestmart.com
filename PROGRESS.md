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

## Phase 2 — Catalog ✅ (built 2026-11-06; rating filter waits for reviews in Phase 7)
- [x] Category tree in the database (admin-managed, 3 levels, attributes, seller suggestions), launch categories seeded
- [x] Products with variants (SKU, price in pesewas, compare-at price, stock), image upload
- [x] Product detail, category and seller store pages, server-rendered, with SEO metadata, JSON-LD and sitemap
- [x] Search (Postgres full-text + trigram), filters (category, price, attributes), sorting
- [x] Seller dashboard: products and inventory, low-stock flags; admin product moderation

## Phase 3 — Cart and checkout ✅ (built 2026-11-07; payment arrives in Phase 4)
- [x] Cart for guests (cookie) merged into the account on login
- [x] Distance-based delivery fees (seller pickup pin, buyer address pin, town-centre fallback, admin-editable bands), address selection
- [x] Atomic checkout: re-price, reserve stock with row locks, create the order plus one sub-order per seller (`awaiting_payment`)
- [x] Reservation expiry (released on checkout/cart/order views, plus a daily Vercel Cron backstop)

## Phase 4 — Payments and money (4a built 2026-11-09 against a local Paystack stand-in; real Paystack test pending keys)
- [x] Paystack payment (MoMo + card); webhook with signature check, verification and idempotency
- [x] Commission per line (category override aware); seller ledger (pending; → available comes with Phase 5)
- [x] Refunds (full and partial), clawback from the seller ledger
- [x] Payouts by Paystack Transfer to seller MoMo / bank, weekly batch (drafted Mondays) approved by the Super Admin; payout history (built 2026-11-13, against the stand-in)

## Phase 5 — Fulfilment ✅ (built 2026-11-11; SMS later)
- [x] Sub-order state machine with status history: paid → processing → shipped → delivered → completed (plus cancelled, refunded; disputes as a separate record that freezes the clock)
- [x] Buyer confirms receipt; auto-confirm after the window; release of held earnings
- [x] Returns and disputes (with photo evidence), handled in the admin area; shipping deadline with buyer cancellation; seller cancellation
- [x] Fulfilment emails (shipped, delivered, overdue, disputes, cancellations) via a transactional outbox with retries

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
- **2026-11-06** — Phase 2 done: admins manage categories and their filters from the website; sellers list products with photos, sizes/colours and stock; shoppers browse, filter and search; admins can take listings down. Also fixed Ghana Card uploads over 1 MB. Next: Phase 3, cart and checkout (needs the delivery fees).
- **2026-11-07** — Phase 3 done: shoppers fill a cart (signed in or not), add an address with a map pin, see a delivery fee worked out from distance, and place an order that holds the stock for 30 minutes; they can cancel, and unpaid orders expire. The Super Admin edits the delivery bands. Next: Phase 4, Paystack payments, commission and seller payouts.
- **2026-11-09** — Phase 4a done: buyers pay for orders (Mobile Money or card through Paystack, tested with a local stand-in until real keys arrive); sellers see their earnings held as pending; admins can refund all or part of an order. Fixed a sign-in crash. Next: test against real Paystack once keys arrive; then Phase 5, fulfilment (shipping, delivery confirmation), then payouts.
- **2026-11-11** — Phase 5 done: sellers accept and ship orders (saying who delivers), buyers confirm delivery or it confirms itself after 7 days, and the seller's money becomes available 3 days later. Buyers can cancel late shipments for a refund or report problems with photos; admins resolve them. Next: weekly payouts to sellers.
- **2026-11-13** — Payouts done: every Monday a payout batch is drafted for sellers with at least GH₵50 available; the Super Admin approves it and the money goes to their MoMo or bank account (failed transfers return to the seller's balance). The money flow is complete end to end. Next: Phase 6, the admin area (settings, reports).
