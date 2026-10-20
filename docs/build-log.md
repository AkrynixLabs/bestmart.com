# Build log

What was built in each session and how it was verified. Newest at the bottom.

## 2026-10-02 to 2026-10-20: Phase 0, foundation

**Replaced** the React 19 + Vite SPA, Express 5 API and Supabase migrations (no live data) with a Next.js 16 App Router app. Logos, category photos and favicons moved to `public/`. The old code is in git history before this commit.

**Built**
- Next.js 16.4 + React 19.3 + TypeScript 5.9 strict (`noUncheckedIndexedAccess`), Tailwind v4 with shadcn tokens mapped to the brand palette (navy/blue/orange), Plus Jakarta Sans.
- Storefront shell: header (search box present but disabled until Phase 2), footer, home page (hero, buyer-protection promises, category tiles, seller call-to-action), 404, error and global-error boundaries, `robots.txt`, `sitemap.xml`, Open Graph metadata.
- Prisma 7.10 with `@prisma/adapter-pg`; local Postgres 17 in Docker on port 5433. First model: `PlatformSettings` (single row) holding the agreed business-rule defaults. Migrations: `init` and `platform_settings_singleton` (CHECK id = 1 plus the default row).
- `lib/env.ts` (Zod, lazy), `lib/logger.ts` (JSON, redaction), `lib/money.ts` (pesewas formatting/parsing, basis-point commission with half-up rounding), `lib/site.ts`.
- Sentry 11 (off without a DSN; no bodies, cookies or user data), baseline security headers, `/api/health` and `/api/health/ready`.
- Vitest (23 unit tests: money, logger, env), Playwright (smoke tests on desktop and Pixel 7 viewports), GitHub Actions CI with a Postgres service.

**Verified**
- `npx tsc --noEmit`, `eslint .`: clean. `vitest run`: 23/23. `next build`: succeeds.
- Production server: `/` 200 with all security headers, `/api/health` ok, `/api/health/ready` ok against the Docker database, unknown path 404, `robots.txt` correct.
- Playwright: 6/6 (3 tests × desktop + mobile), including a no-horizontal-scroll check. Screenshots reviewed at 1366px and 390px.
- Fresh `npm ci` with npm 10.8 succeeds and generates the Prisma client.

**Not verified / notes**
- The `platform_settings_singleton` migration was written but **not applied locally**: Claude Code's auto mode blocked `prisma migrate deploy`. Run `npm run db:migrate` once. CI applies all migrations on a fresh database.
- The CI workflow hasn't run on GitHub yet (nothing pushed).
- `npm audit` reports a high-severity picomatch advisory with no fix; documented in `docs/SECURITY.md`, CI audits at `critical`.
- Not deployed to Vercel (no BestMart Vercel project yet).
