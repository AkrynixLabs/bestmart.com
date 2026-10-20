# Development guide

## Environment

Copy `.env.example` to `.env`. The defaults point at the local Docker database and need no changes for development. Each later phase adds its keys (Auth.js, Paystack, Resend, ...) to `.env.example` and to `lib/env.ts`.

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

Playwright runs against a production build: `npm run build && npm run test:e2e`. It reuses a server already running on port 3100 locally. Install its browser once with `npx playwright install chromium`.

Before calling work done: `npm run check` plus the relevant e2e tests.

## Conventions

- **Commits:** single-line Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`, `test: ...`, `refactor: ...`), no body, no trailers.
- Docs (`CLAUDE.md`, `PROGRESS.md`, `docs/build-log.md`) are updated in the same commit as the change they describe.
- Server Actions return `{ error }` for expected failures instead of throwing (production strips thrown messages).
- Role and ownership checks are server-side on every page, action and route handler.
- `notes/` is personal and git-ignored; don't put anything the project depends on there.

## npm versions

The lockfile was created with npm 11 (npm 10.8 has a bug resolving Vitest's optional peers on a fresh install). `npm ci` works with npm 10 and 11. If `npm install <pkg>` fails with `Cannot read properties of null (reading 'edgesOut')`, use `npx npm@11 install <pkg>`. npm 11 asks before running install scripts; the approved ones are listed under `allowScripts` in `package.json`.
