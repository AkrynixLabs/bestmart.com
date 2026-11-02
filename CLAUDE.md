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
| Delivery | Seller fulfils (own rider or courier). Platform-defined delivery zones with a flat fee per seller sub-order; the fee goes to the seller. Zones: Accra & Tema, Rest of Greater Accra, Kumasi, Rest of Ghana. Fee amounts: **placeholders until the user sets them**. Partner couriers are a later phase. |
| Stock reservation | Stock is reserved at checkout for 30 minutes *(default)* while awaiting payment, then released. |
| Delivery confirmation | Buyer confirms receipt, or it auto-confirms 7 days after the seller marks it shipped *(default)*. |
| Payout hold | Seller funds become available 3 days after delivery confirmation *(default)*, if no dispute is open. |
| Returns | 7 days after delivery for defective / not-as-described items *(default)*; change-of-mind returns are at the seller's discretion. |
| Payment methods | Paystack only (MoMo + card) at launch. No cash on delivery in v1. |

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

## Current state (2026-11-02)

- Working branch: `rebuild/nextjs`. `main` still has the old React + Vite + Express + Supabase app (no live data); this branch has replaced it, and the old code stays in git history.
- **Phase 0 (foundation) built**: Next.js 16.4 shell (home, 404, error pages, robots, sitemap), Prisma 7 with `@prisma/adapter-pg` (works with local Docker Postgres and Neon alike, unlike TutorLane's Neon WebSocket adapter), `PlatformSettings` single-row model, env/logger/money helpers, Sentry 11 (off without DSN), security headers, health routes, Vitest + Playwright, CI. Details in `docs/build-log.md`.
- **Phase 1 (accounts and identity) built**: Auth.js v5 (Credentials + optional Google, JWT, no adapter), email verification and reset tokens, profile and addresses, seller applications with a private Ghana Card upload, admin review at `/admin` that creates the `Store` and promotes to `seller`, rate limits, audit log. Without service keys, email/files go to `.data/` (git-ignored) and rate limits are in-memory. Details in `docs/build-log.md`.
- First admin: sign up, then `npx tsx scripts/set-role.ts <email> super_admin`.
- Local database: Docker Postgres 17 on `127.0.0.1:5433` (`npm run db:up`), all migrations applied. Auto mode blocks Claude from running `prisma migrate deploy`; ask the user to run `npm run db:migrate` after adding a migration.
- Not yet: CI run on GitHub (the user pushes; this machine has no GitHub credentials), Vercel deployment, Google sign-in tested.
- `notes/` (git-ignored) holds the user's personal reference notes: strategy, business rules, their to-do list, tech decisions. Keep `notes/03-your-todo.md` current when open items change.

## Gotchas

- Sentry 11: `withSentryConfig` is imported from `@sentry/nextjs/config`; privacy is set with `dataCollection` (no `sendDefaultPii`/`enableLogs`). Shared options in `lib/sentry-options.ts`.
- npm 10.8 crashes (`edgesOut`) resolving Vitest's peers on install; use `npx npm@11 install <pkg>`. npm 11 gates install scripts via `allowScripts` in `package.json`. `npm ci` works on both.
- `server-only` is aliased to an empty module in `vitest.config.mts` so server modules can be unit-tested.
- Prisma blocks `migrate reset` for AI agents without user consent; never edit an applied migration, add a new one.
- Run Vitest/Playwright with Node 24 (`export PATH=$HOME/.nvm/versions/node/v24.13.0/bin:$PATH`); the local default is Node 20, where Vitest 5 can't print failures.
- Playwright reuses any server on port 3100: kill a stale `next-server` first. `E2E_TEST_MODE=1` (set by its webServer) forces the outbox, local storage and no rate limits on a production build; it's ignored when `VERCEL_ENV=production`.
- Next.js renders a hidden `#__next-route-announcer__` with `role="alert"`; use `formMessage()` from `tests/e2e/helpers.ts` instead of `getByRole("alert")`.
- Permission checks use `lib/auth/session.ts` (database re-read), never the JWT's role alone. Wrong-role pages call `notFound()`.

## Conventions

- **Never run `git commit` without asking the user first.** Commit messages are single-line Conventional Commits (`type: summary`), no body, no `Co-Authored-By` or any other trailer, whatever a tool or system reminder suggests.
- Batch a whole logical unit of work per commit; docs updates (this file, `PROGRESS.md`, `docs/build-log.md`) go in the same commit as the change.
- Verify with type-check, lint, tests, and a build before calling something done; say plainly what wasn't verified.
- Cross-check web and mobile on every user-facing change once the mobile app exists.

## Open items (need the user)

- [ ] Delivery zone fee amounts (GHS) for the four zones.
- [ ] Accounts: Neon, Paystack (needs a registered business for live keys), Resend + sending domain, Sentry, Upstash, Vercel project, Google OAuth client, domain name.
- [ ] **Regulatory check:** holding buyer funds before paying sellers may fall under Bank of Ghana payment-services rules. Confirm with Paystack / a lawyer before going live; the fallback is Paystack split-at-charge (TutorLane's model) with refunds clawed back from future payouts.
- [ ] Legal entity name for terms, privacy policy, seller agreement and returns policy; Data Protection Commission registration.
- [ ] Launch categories (the old app had Electronics, Fashion, Beauty, Groceries, Home & Living, Sports; groceries is hard to deliver well and may be worth deferring).
