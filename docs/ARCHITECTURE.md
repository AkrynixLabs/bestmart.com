# Architecture

Business rules (commission, delivery, payout timing) are in [`CLAUDE.md`](../CLAUDE.md). This document covers how the system is built.

## Overview

```mermaid
flowchart LR
  Browser[Browser] --> Next
  App[Flutter app<br/>Phase 8] -->|/api/mobile/*| Next
  subgraph Vercel
    Next[Next.js App Router<br/>pages · Server Actions · route handlers]
    Cron[Vercel Cron<br/>Phase 3+]
  end
  Next --> DB[(PostgreSQL<br/>Neon)]
  Cron --> Next
  Next -.-> Paystack[(Paystack<br/>Phase 4)]
  Paystack -.->|webhooks| Next
  Next -.-> Resend[(Resend<br/>Phase 1)]
  Next -.-> Blob[(Vercel Blob<br/>Phase 1-2)]
  Next -.-> Sentry[(Sentry)]
```

One Next.js application serves the storefront, the seller dashboard, the admin area and the API. Public catalog pages are server-rendered so search engines can index them. Writes go through Server Actions (web) or route handlers (mobile app, webhooks), and every one checks the caller's role and ownership on the server.

## Core design rules

1. **Money is integer pesewas** (`Int`), percentages are basis points. Helpers in `lib/money.ts`; never use floats for money.
2. **Business numbers live in `PlatformSettings`** (single row), editable by the Super Admin, never hard-coded.
3. **Checkout is one transaction** that re-prices from the database and reserves stock with row locks (Phase 3).
4. **Multi-seller orders split into per-seller sub-orders**, each with its own status machine and history (Phase 3, 5).
5. **Seller money is a ledger** (pending → available → paid out), driven by delivery confirmation and the payout hold (Phase 4).
6. **Webhooks are verified and idempotent** (signature check, then re-verify with Paystack, then process each event once) (Phase 4).
7. **Server-side authorization everywhere.** Hiding a button is never the check.
8. **Configuration is validated** (`lib/env.ts`, Zod) and read lazily, so a missing key fails loudly on first use.

## Data access

Prisma 7 with the `@prisma/adapter-pg` (node-postgres) driver adapter. The same driver works against the local Docker database and Neon's pooled endpoint. `DATABASE_URL` is the pooled connection used at runtime; `DIRECT_URL` is the direct connection used by migrations (`prisma.config.ts`). The generated client lives in `lib/generated/prisma` (git-ignored, generated on `npm install`).

## Catalog

- **Categories** are rows, not code: an admin-edited tree (max 3 levels) with per-category attributes inherited down the tree. The whole tree is one cached query (`lib/catalog/categories.ts`, tag `categories`), and pure helpers in `lib/catalog/tree.ts` answer visibility, inheritance and move checks. Admin actions invalidate the tag, so changes are live on the next request.
- **Products** hold options as JSON and one `ProductVariant` row per combination (SKU, price, stock). The product row keeps a denormalised price range and stock total for listing and sorting without joins. A product is public only if it's active, not blocked, its store is active and its category and all ancestors are active.
- **Search** goes through `lib/search/` (`CatalogSearch` interface). The Postgres implementation uses a trigger-maintained weighted `tsvector` plus `pg_trgm` word similarity, attribute filters as indexed `EXISTS` subqueries, and keyset pagination for browse sorts. A dedicated engine can replace it behind the same interface.
- **URLs:** `/c/<slug>` (old slugs 301), `/p/<slug>` (never changes), `/s/<slug>`, `/search`. Sitemaps are an index plus 10,000-URL files built on request.

## Cart, delivery and checkout

- **Cart:** a guest cart is found by an httpOnly cookie token; after sign-in it's merged into the account cart in the database on the next request. Lines show live price, stock and availability.
- **Delivery fee** (`lib/delivery/fee.ts`): one per seller sub-order. Distance is measured from the seller's pickup pin to the buyer's address pin (straight line × road factor). If either pin is missing, it falls back to neighbourhood, town or regional-capital centres from `lib/delivery/places.ts`; the quote records which source it used. Price comes from the admin-edited distance bands. Real road distances can replace this behind `quoteDelivery()`.
- **Checkout** (`lib/checkout/orders.ts`): one transaction that locks the variant rows (`FOR UPDATE`, in id order to avoid deadlocks), re-checks and re-prices everything, writes the order, one sub-order per seller and snapshot line items, and reserves stock by decrementing it. A per-user idempotency key makes retries return the same order.
- **Reservation expiry:** an unpaid order is claimed with a conditional status update before its stock is returned, so expiry, cancellation and (Phase 4) payment can't both succeed. Expired orders are released whenever someone checks out or views a cart or order, and by a cron backstop.

## Payments and the seller ledger

- **Provider layer** (`lib/payments/`): `PaymentProvider` (initialize, verify, refund, verifySignature) with a Paystack implementation and a local stand-in for development and tests. `paymentProvider()` picks one from the environment.
- **Paying:** the order page starts a `Payment` (unique reference per attempt) and sends the buyer to the hosted checkout. Both the return page and the webhook call `confirmPayment(reference)`, which asks the provider for the truth and is idempotent.
- **Money where it sits:** the platform's Paystack balance holds buyer payments. The `LedgerEntry` table records what each seller is owed (sale +, commission −, delivery +; refunds −, commission returned +), in `pending` until delivery is confirmed and the hold passes (Phase 5), then `available` for payouts (after Phase 5).
- **Refunds** reserve their amount on the sub-order under a row lock, call the provider, and write ledger entries once the provider confirms.

## Fulfilment

- **State machine** (`lib/fulfilment/rules.ts`): each seller's sub-order goes paid → processing → shipped → delivered → completed, or is cancelled (and refunded) before shipping. `allowed(status, action, actor)` decides who can do what; `transition()` applies a change as a conditional update and records a `SubOrderEvent`, the timeline shown to everyone.
- **Clocks:** the shipping deadline (`shipBy`, set at payment), auto-confirmation (shipped + N days) and earnings release (delivered + hold days) are timestamps checked by `runFulfilmentJobs()`, run daily by `/api/cron/daily` and on order and earnings page views. An open `Dispute` stops both auto-confirmation and release.
- **Disputes** are separate records (reason, description, private photos, seller response, outcome) resolved by an admin through `issueRefund`.
- **Email outbox:** `enqueueEmail(tx, …)` inside the transaction, `flushOutbox()` afterwards and from the cron, with exponential backoff and a cap on attempts.

## Observability

- `lib/logger.ts`: one-line JSON logs with key-based secret redaction (tokens, passwords, Ghana Card numbers).
- Sentry: errors and traces when `NEXT_PUBLIC_SENTRY_DSN` is set. Request bodies, cookies and automatic user data are not sent (`lib/sentry-options.ts`).
- `GET /api/health` (liveness, no dependencies) and `GET /api/health/ready` (database round trip, 503 on failure).
