// One error type for everything the API deliberately reports to a client.
// Route code throws these; the central handler in app.js turns them into
// the standard response body:
//
//   { error: "<human message>", code: "<MACHINE_CODE>", requestId, details? }
//
// `error` stays a plain string so the existing web client (src/lib/apiClient.js)
// keeps working unchanged. Anything that is NOT an AppError is treated as a
// bug: logged in full, answered with a generic 500 that leaks nothing.

export class AppError extends Error {
  /**
   * @param {number} status HTTP status (4xx for client errors).
   * @param {string} code Stable machine-readable code, e.g. "NOT_FOUND".
   * @param {string} message Safe to show to the end user.
   * @param {unknown} [details] Optional structured info (e.g. validation issues).
   */
  constructor(status, code, message, details) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** @param {string} message @param {unknown} [details] */
export const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details)
/** @param {string} [message] */
export const unauthorized = (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message)
/** @param {string} [message] */
export const forbidden = (message = 'You do not have permission to do that') => new AppError(403, 'FORBIDDEN', message)
/** @param {string} [message] */
export const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message)
/** @param {string} message */
export const conflict = (message) => new AppError(409, 'CONFLICT', message)
/** @param {string} [message] */
export const tooManyRequests = (message = 'Too many requests, please slow down') =>
  new AppError(429, 'RATE_LIMITED', message)

/**
 * Wraps a database/storage error so the raw driver message (table names,
 * constraint names, SQL hints) is logged server-side but never sent to the
 * client. Returns a plain Error, which the handler answers as a 500.
 *
 * @param {string} context What was being attempted, for the log.
 * @param {unknown} cause The Supabase/PostgREST error object.
 */
export function dbError(context, cause) {
  const error = new Error(`Database error: ${context}`)
  error.cause = cause
  return error
}
