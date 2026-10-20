# BestMart

**Publish · Advertise · Sell.** A Ghana-focused multi-vendor marketplace: shoppers buy from verified independent sellers, pay with Mobile Money or card through Paystack, and their money is held until the order arrives.

> **Status:** rebuild in progress (Phase 0 of 10, foundation). See [PROGRESS.md](PROGRESS.md) for the phase checklist and [CLAUDE.md](CLAUDE.md) for current decisions and business rules.

## Stack

| Concern | Choice |
|---|---|
| Web + API | Next.js 16 (App Router), React 19, TypeScript strict |
| UI | Tailwind CSS v4, shadcn/ui, lucide icons |
| Database | PostgreSQL 17 (Docker locally, Neon in production), Prisma 7 |
| Monitoring | Sentry (off until a DSN is set), structured JSON logs |
| Tests | Vitest (unit), Playwright (end-to-end, desktop + mobile) |
| CI | GitHub Actions: lint, type-check, migrations, unit, build, e2e, audit |
| Hosting | Vercel |

Coming in later phases: Auth.js, Paystack, Resend, Upstash, Vercel Blob and a Flutter mobile app.

## Getting started

Requirements: Node.js 20.19+ (24 recommended), Docker.

```bash
cp .env.example .env        # defaults work with the local Docker database
npm install
npm run db:up               # Postgres 17 on localhost:5433
npm run db:migrate          # apply migrations
npm run dev                 # http://localhost:3000
```

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright against a production build (run `npm run build` first) |
| `npm run check` | Lint + type-check + unit tests + build |
| `npm run db:up` / `db:down` | Start / stop the local database |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Prisma Studio |

## Project layout

```
app/                 routes (pages, layouts, route handlers under app/api)
components/          layout/ (header, footer), ui/ (shadcn components)
lib/                 env, prisma, logger, money, site config; lib/generated = Prisma client (ignored)
prisma/              schema.prisma + migrations/
public/              brand/ (logos), images/ (category photos), favicons
tests/               unit/ (Vitest), e2e/ (Playwright)
docs/                architecture, security, development guide, build log
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the system fits together and the core design rules
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): environment, migrations, testing, commit conventions
- [docs/SECURITY.md](docs/SECURITY.md): security model and known exceptions
- [docs/build-log.md](docs/build-log.md): what was built in each session and how it was verified

## History

BestMart began as a React + Vite + Express + Supabase project in the WomenTechsters programme. In October 2026 it was rebuilt on Next.js to match the stack of the author's other production projects; the earlier version is preserved in git history.
