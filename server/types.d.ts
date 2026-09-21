// Fields our own middleware attaches to the Express request. Declared once
// here so every route is type-checked against them (see middleware/auth.js).
import 'express-serve-static-core'

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlation id for this request (middleware/requestContext.js). */
    id: string
    /** Set by authenticate(). */
    userId: string
    userEmail: string
    userMetadata: Record<string, unknown>
    /** Set by loadProfile(): the raw profiles row. */
    profile: import('./lib/rows.js').ProfileRow
    /** Set by ownership loaders in individual routers. */
    product: import('./lib/rows.js').ProductRow
    conversation: import('./lib/rows.js').ConversationRow
  }
}
