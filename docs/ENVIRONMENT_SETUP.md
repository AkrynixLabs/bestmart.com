# Environment Setup

## Prerequisites

- Node.js 22 (matches `engines` in package.json and CI)
- A Supabase project (free tier works)

## Local development

```bash
npm install
cp .env.example .env      # then fill in values (below)
npm run dev               # Vite on :5173 + API on :3001 (proxied as /api)
```

Apply the SQL files in `supabase/migrations/` **in order** (001 → 007) in the
Supabase SQL editor. Then create a public Storage bucket named
`product-images`.

## Variables

| Name | Where used | Required | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | browser | yes | Project URL. Public. |
| `VITE_SUPABASE_ANON_KEY` | browser | yes | Anon key. Public by design; RLS limits it to reads. |
| `SUPABASE_URL` | API | yes | Same project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | API | yes | **Secret.** Bypasses RLS. Never prefix with `VITE_`. |
| `CORS_ORIGINS` | API | no | Comma-separated extra browser origins. Default: same-origin only. |
| `LOG_LEVEL` | API | no | `debug`, `info` (default), `warn`, `error`. |

The API validates its variables on first use (`server/config/env.js`). A
missing or malformed value produces a 500 with a clear message in the logs,
and `/api/health/ready` returns 503.

## Environments

| Environment | Supabase project | Vercel |
|---|---|---|
| Development | your own dev project | `npm run dev` |
| Preview | a shared staging project | Preview deployments (env vars scoped to *Preview*) |
| Production | production project | Production deployment |

Never point a development or preview deployment at the production database.

## Quality checks

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript strict mode over server/, api/, shared/
npm test            # Vitest: unit + integration (no network needed)
npm run build       # production bundle
npm run check       # all of the above, as CI runs it
```
