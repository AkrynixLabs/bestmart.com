import { badRequest } from './errors.js'

/**
 * Parses `req.body` (or `req.params`) with a Zod schema and replaces it with
 * the parsed, typed, unknown-key-stripped result. On failure, responds 400
 * with the first issue as the message and every issue under `details`.
 *
 * @param {import('zod').ZodType} schema
 * @param {'body' | 'params'} [source]
 * @returns {import('express').RequestHandler}
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {})
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      return next(badRequest(issues[0]?.message ?? 'Invalid request', issues))
    }
    // Express 5 makes req.query a getter, but body and params are plain
    // properties and safe to overwrite.
    req[source] = result.data
    next()
  }
}
