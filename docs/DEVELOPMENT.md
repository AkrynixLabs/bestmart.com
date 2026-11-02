# Development guide

## Environment

Copy `.env.example` to `.env` and set `AUTH_SECRET` (`openssl rand -base64 32`). The other defaults point at the local Docker database and need no changes for development. Each later phase adds its keys to `.env.example` and to `lib/env.ts`.

Without service keys, development falls back to local stand-ins (never in production):

| Service | Without a key |
|---|---|
| Resend (email) | Emails are written as JSON to `.data/outbox/`; open the newest file to click a verification or reset link |
| Vercel Blob (KYC files) | Files are stored in `.data/private/` |
| Upstash (rate limits) | In-memory limits, per server process |
| Google sign-in | The button is hidden |

`.data/` is git-ignored. `E2E_TEST_MODE=1` forces these fallbacks on a production build (Playwright sets it) and is ignored on Vercel production.

## Admin accounts

Sign up normally and confirm the email, then promote the account:

```bash
npx tsx scripts/set-role.ts you@example.com super_admin   # or ops_admin, or customer to demote
```

Seller is never set this way; it comes only from an approved application.

On Vercel, set the same variables per environment (Production / Preview / Development). For Neon, `DATABASE_URL` is the **pooled** connection string and `DIRECT_URL` the **direct** one.

## Database and migrations

```bash
npm run db:up                                    # start Postgres (localhost:5433)
npx prisma migrate dev --name <change_name>      # after editing prisma/schema.prisma (local only)
npm run db:migrate                               # apply pending migrations (CI, production)
npm run db:studio                                # browse data
```

- Never edit a migration that has already been applied anywhere; add a new one.
- Hand-written SQL (constraints, seed rows Prisma can't express) goes in its own migration.
- Money columns are `Int` pesewas; percentage columns are `Int` basis points.

## Testing

| Layer | Tool | Location |
|---|---|---|
| Unit (pure logic: money, validation, state machines) | Vitest | `tests/unit/` |
| End-to-end journeys, desktop + mobile viewport | Playwright | `tests/e2e/` |

Use Node 22 or newer for tests (Vitest 5 can't print failures on Node 20; CI and Vercel use 24). With nvm: `nvm use 24`.

Playwright runs against a production build: `npm run build && npm run test:e2e`. It reuses a server already running on port 3100, so stop any old one first or you'll test a stale build. Install its browser once with `npx playwright install chromium`. The tests read emails from `.data/outbox/` and promote an admin with `scripts/set-role.ts`; data they create stays in the local database, so tests use unique emails and names.

Before calling work done: `npm run check` plus the relevant e2e tests.

## Conventions

- **Commits:** single-line Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`, `test: ...`, `refactor: ...`), no body, no trailers.
- Docs (`CLAUDE.md`, `PROGRESS.md`, `docs/build-log.md`) are updated in the same commit as the change they describe.
- Server Actions return `{ error }` for expected failures instead of throwing (production strips thrown messages).
- Role and ownership checks are server-side on every page, action and route handler.
- `notes/` is personal and git-ignored; don't put anything the project depends on there.

## npm versions

The lockfile was created with npm 11 (npm 10.8 has a bug resolving Vitest's optional peers on a fresh install). `npm ci` works with npm 10 and 11. If `npm install <pkg>` fails with `Cannot read properties of null (reading 'edgesOut')`, use `npx npm@11 install <pkg>`. npm 11 asks before running install scripts; the approved ones are listed under `allowScripts` in `package.json`.
