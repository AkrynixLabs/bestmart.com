# Security

## In place (Phase 0)

- **Security headers** on every response (`next.config.ts`): HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` removed.
- **Validated configuration** (`lib/env.ts`); secrets are server-only (`server-only` import guard). Only `NEXT_PUBLIC_*` values reach the browser.
- **Log redaction** of tokens, passwords, cookies, keys and ID numbers (`lib/logger.ts`).
- **Sentry privacy:** no request bodies, cookies or automatic user data.
- **Health endpoints** don't leak error details.
- **CI dependency audit** on runtime dependencies.

## Planned

| Phase | Control |
|---|---|
| 1 | Auth.js with hashed passwords, email verification, single-use reset tokens; role guards on every page/action; rate limiting (Upstash) on auth and sensitive actions; audit log |
| 1 | Seller KYC documents in a **private** Blob store, served only through authorised routes |
| 4 | Strict Content-Security-Policy with nonces (Paystack, Sentry origins) |
| 4 | Paystack webhook signature verification, server-side re-verification, idempotent processing; no card data ever touches our servers (Paystack-hosted checkout) |
| 9 | Pre-launch review: OWASP checklist, dependency review, backup/restore drill |

## Known exceptions

- **picomatch ReDoS advisory (GHSA-fc5q-39xc-vjpf), high, no fixed version (2026-10-20).** It comes in through `@sentry/nextjs` (its build-time Rollup plugin) and Vite/Vitest. picomatch only matches file globs from our own config during builds and tests; no user input reaches it, so it isn't exploitable here. CI audits at `critical` until a fixed version exists; then return to `high`.

## Reporting

Report suspected vulnerabilities privately to the maintainer rather than opening a public issue.
