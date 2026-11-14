// Time-based one-time passwords (RFC 6238, the codes authenticator apps
// show), on Node's crypto only. HMAC-SHA1, 30-second steps, 6 digits:
// the defaults every authenticator app supports.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
export const STEP_SECONDS = 30

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "")
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) throw new Error("Invalid base32")
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** A new random secret (160 bits), base32 as authenticator apps expect. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function stepAt(time: number): number {
  return Math.floor(time / 1000 / STEP_SECONDS)
}

/** The code for a given 30-second step. */
export function totpAt(secret: string, step: number, digits = 6): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const binary = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!
  return String(binary % 10 ** digits).padStart(digits, "0")
}

export function totpNow(secret: string, now = Date.now()): string {
  return totpAt(secret, stepAt(now))
}

/**
 * Checks a code against the current step and one step either side (phone
 * clocks drift). Returns the matching step, or null. Callers must reject a
 * step at or before the last one used, so a code can't be replayed.
 */
export function verifyTotp(secret: string, code: string, now = Date.now(), window = 1): number | null {
  const given = code.replace(/\s/g, "")
  if (!/^\d{6}$/.test(given)) return null
  const current = stepAt(now)
  for (let step = current - window; step <= current + window; step++) {
    const expected = totpAt(secret, step)
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return step
  }
  return null
}

/** The link authenticator apps open (and what a QR code would contain). */
export function otpauthUri(secret: string, account: string, issuer = "BestMart"): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`
}

/** "ABCD EFGH ..." for typing into an app. */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim()
}
