# Contributing

## Workflow

1. Branch from `main` (`feature/…`, `fix/…`).
2. Make the change with tests.
3. Run `npm run check` (lint, type-check, tests, build); CI runs the same.
4. Open a pull request describing **what** changed and **why**.

## Rules that keep the platform safe

- **Never trust the client.** Prices, totals, seller ids, roles, and emails
  are always derived server-side.
- **All writes go through the API.** Don't add RLS write policies for the
  browser; add an API route with validation and authorization instead.
- **Validate with Zod.** Put request schemas in `shared/schemas/` and apply
  them with `validate(schema)` / `validate(schema, 'params')`.
- **Throw, don't respond, on errors.** Use `badRequest`, `forbidden`,
  `notFound`, `conflict` from `server/common/errors.js`, and
  `dbError(context, error)` for database failures. Never send a raw
  database message to the client.
- **Log with `logger`**, never `console`, and never log bodies, tokens, or
  personal data.
- **Money:** round to 2 decimals at every boundary. Integer pesewas arrive
  in Phase 4.
- **Migrations are append-only.** Never edit an applied migration; add a new
  numbered file.
- **No silent failures.** Every Supabase call checks `error`.

## Code style

- ES modules; type annotations via JSDoc. The server is type-checked in
  strict mode, so no implicit `any`.
- Prefer small, named functions over large handlers.
- Comments explain *why*, not *what*.

## Tests

- Unit tests: `tests/unit/` (schemas, utilities).
- Integration tests: `tests/integration/` run the real Express app against
  an in-memory fake Supabase (`tests/helpers/fakeSupabase.js`). Add a case
  for every new route, **including the forbidden and invalid cases**.

## Commits

Conventional style: `feat:`, `fix:`, `docs:`, `test:`, `chore:`,
`refactor:`, `ci:`.
