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

## Current state (2026-09-29)

- Working branch: `rebuild/nextjs`. `main` still has the old React 19 + Vite SPA, Express 5 API and Supabase (no live data, so nothing to migrate; only brand, design, photos and business rules carry over). The old code is removed on this branch as the Next.js app replaces it; it stays in git history.
- Plan written, **awaiting the user's approval** before Phase 0 starts.

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
