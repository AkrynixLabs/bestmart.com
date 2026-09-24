# API

Base path: **`/api/v1`**. The unversioned `/api/*` paths are kept as
aliases for already-deployed clients and will be removed in a future
version.

## Conventions

- **Auth:** `Authorization: Bearer <Supabase access token>` on every route
  except `GET /products` and health checks.
- **Bodies:** JSON, max 100KB. Uploads use `multipart/form-data` with one
  `file` field.
- **Casing:** requests and responses use camelCase.
- **Money:** cedis (GHS) as numbers rounded to 2 decimals. *(Phase 4 moves
  storage to integer pesewas; the API shape will stay the same.)*
- **Unknown fields** in request bodies are ignored.
- **Every response** carries `X-Request-Id`.

### Errors

```json
{ "error": "Choose a valid category", "code": "BAD_REQUEST", "requestId": "4f1c…", "details": [{ "path": "category", "message": "Choose a valid category" }] }
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Validation failed or malformed JSON (`details` lists issues) |
| 401 | `UNAUTHORIZED` | Missing, invalid, or expired token |
| 403 | `FORBIDDEN` | Signed in but not allowed (e.g. not a seller, not your product) |
| 404 | `NOT_FOUND` | Doesn't exist, or you can't see it |
| 409 | `CONFLICT` | State changed (e.g. cart items no longer available) |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 100KB |
| 429 | `RATE_LIMITED` | Slow down; see `Retry-After` |
| 500 | `INTERNAL` | Our fault; quote the `requestId` |

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness: function runs, env vars present (no dependencies) |
| GET | `/api/health/ready` | Readiness: config valid and database reachable; 503 if not |

## Endpoints

### Products

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/products` | public | — | All seller products |
| POST | `/products` | seller | `{name, category, price, oldPrice?, images?}` | Seller name, `isNew` set by server; `rating`, `bestSeller` ignored |
| PATCH | `/products/:id` | owner | any subset of the above | `oldPrice: null` clears it; must exceed price |
| DELETE | `/products/:id` | owner | — | 204 |
| POST | `/products/images` | seller | multipart `file` | Returns `{url}`; 30 per 10 min |

### Cart

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/cart` | — | Caller's lines |
| POST | `/cart` | `{productId}` | Adds or increments; price/seller from server |
| PATCH | `/cart/:productId` | `{qty}` | 1–99 |
| DELETE | `/cart/:productId` | — | 204 |

### Checkout and orders

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/checkout` | user | Re-prices the cart, creates the order, empties the cart. 409 if items vanished. 10/min |
| GET | `/orders` | user | Caller's purchase history |
| GET | `/seller/orders` | seller | Orders containing the seller's items (only their lines) |
| PATCH | `/seller/orders/:id/status` | seller | Advances Processing → Shipped → Delivered |
| GET | `/seller/stats` | seller | `{orderCount, revenue}` |

### Profile

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/profile` | — | Creates a default profile on first call |
| PATCH | `/profile` | `{name?, phone?, businessName?, businessCategory?, businessAddress?, storeDescription?, businessLogo?, isSeller?}` | `email` is never writable |
| POST | `/profile/logo` | multipart `file` | Returns `{url}` |

### Messaging

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/conversations` | — | Caller's threads with preview and unread flag |
| POST | `/conversations` | `{sellerId}` | Find-or-create; target must be a seller |
| GET | `/conversations/:id/messages` | — | Participants only |
| POST | `/conversations/:id/messages` | `{body, productId?}` | 1–2000 chars; 30/min |
| PATCH | `/conversations/:id/read` | — | Marks thread read |

*(Planned: OpenAPI document generated from the Zod schemas, served at
`/api/v1/openapi.json`.)*
