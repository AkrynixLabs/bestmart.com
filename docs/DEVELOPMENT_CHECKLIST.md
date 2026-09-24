# Development Checklist

Living status of the platform roadmap. `[x]` means implemented **and**
tested. Anything partial says what's missing.

## Phase 1: Discovery and architecture ✅
- [x] Workspace inspection, architecture proposal, stack decision
- [x] [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)

## Phase 2: Foundation ✅
- [x] Baseline security fixes committed (server-side pricing, locked-down RLS writes)
- [x] TypeScript strict type-checking for server/, api/, shared/ (`npm run typecheck`)
- [x] ESLint (`npm run lint`), including React hooks rules
- [x] Vitest + Supertest; unit tests + integration tests against a fake Supabase
- [x] Validated env config (`server/config/env.js`)
- [x] Shared Zod schemas for all write endpoints (`shared/schemas/`)
- [x] Central error handling: `{error, code, requestId}`, no DB messages leaked
- [x] Structured JSON logging with secret redaction and request ids
- [x] helmet security headers, CORS allow-list, `Cache-Control: no-store`
- [x] Rate limiting on checkout, messages, uploads. **Gap:** in-memory per instance; needs a shared store
- [x] Readiness check with database probe (`/api/health/ready`)
- [x] API versioning (`/api/v1`, `/api` kept as an alias)
- [x] GitHub Actions CI: lint, type-check, test, build, audit
- [x] Docs: architecture, security, API, environment, contributing, this checklist
- [ ] Verify the Vercel deployment end to end *(needs the project owner: env vars + redeploy)*
- [ ] Apply migration 007 in Supabase *(needs the project owner)*

## Phase 3: Identity and security
- [ ] Roles, permissions, user_roles, role_permissions tables + seed
- [ ] `requirePermission()` middleware; replace the `is_seller` self-service flag with an approval flow
- [ ] Addresses (customer-owned, validated)
- [ ] Audit log table + writes for sensitive actions
- [ ] Shared rate-limit store

## Phase 4: Catalog and inventory
- [ ] Money as integer pesewas (migration + API mapping)
- [ ] Categories table; demo catalog moved to seed data
- [ ] Product variants; inventory per variant; stock movements
- [ ] Low-stock alerts

## Phase 5: Checkout
- [ ] Postgres function: reprice + reserve stock (row locks) + create order atomically
- [ ] Reservation expiry job; cart expiry
- [ ] Coupons and promotions

## Phase 6: Orders and payments
- [ ] Per-seller sub-orders (fixes shared status on mixed-seller orders)
- [ ] Order state machine + status history
- [ ] Payment provider interface; Paystack adapter
- [ ] Webhooks: signature check, verification, idempotency
- [ ] Refunds, cancellations

## Phase 7: Logistics and engagement
- [ ] Shipments and tracking
- [ ] Email/SMS notifications via outbox
- [ ] Verified-purchase reviews

## Phase 8: Administration and analytics
- [ ] Admin area (users, sellers, orders, payments, reviews)
- [ ] Reports
- [ ] Audit log viewer

## Phases 9–10: Quality and release
- [ ] Playwright end-to-end journeys
- [ ] Load test on checkout
- [ ] Monitoring/alerting, backup and rollback runbook
