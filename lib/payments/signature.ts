import { createHmac, timingSafeEqual } from "node:crypto"

/** Paystack signs webhooks with HMAC-SHA512 of the raw body, keyed by the secret key. */
export function signBody(rawBody: string, secret: string): string {
  return createHmac("sha512", secret).update(rawBody).digest("hex")
}

export function signatureMatches(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false
  const expected = Buffer.from(signBody(rawBody, secret), "hex")
  const given = Buffer.from(signature, "hex")
  return expected.length === given.length && timingSafeEqual(expected, given)
}
