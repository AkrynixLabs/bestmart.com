// Small symmetric crypto helpers keyed from AUTH_SECRET (pure: the caller
// passes the secret). Used for TOTP secrets at rest and the admin 2FA cookie.

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto"

function key(appSecret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", appSecret, "bestmart", purpose, 32))
}

/** AES-256-GCM; output "v1.<iv>.<tag>.<ciphertext>" (base64url). */
export function encrypt(plaintext: string, appSecret: string, purpose: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(appSecret, purpose), iv)
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".")
}

export function decrypt(box: string, appSecret: string, purpose: string): string {
  const [version, iv, tag, data] = box.split(".")
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unreadable secret")
  const decipher = createDecipheriv("aes-256-gcm", key(appSecret, purpose), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")
}

/** "<payload>.<hmac>" where payload is "userId.expiresAtMs". */
export function signToken(payload: string, appSecret: string, purpose: string): string {
  return `${payload}.${createHmac("sha256", key(appSecret, purpose)).update(payload).digest("base64url")}`
}

/** The payload if the signature is valid, else null. */
export function verifyToken(token: string, appSecret: string, purpose: string): string | null {
  const cut = token.lastIndexOf(".")
  if (cut <= 0) return null
  const payload = token.slice(0, cut)
  const expected = Buffer.from(signToken(payload, appSecret, purpose))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given) ? payload : null
}
