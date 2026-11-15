import { describe, expect, it } from "vitest"

import { decrypt, encrypt, signToken, verifyToken } from "@/lib/auth/secret-box"
import { base32Decode, base32Encode, generateTotpSecret, otpauthUri, stepAt, totpAt, verifyTotp } from "@/lib/auth/totp"

// RFC 6238 appendix B (SHA-1), secret "12345678901234567890"; 6-digit codes are the last 6 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"))

describe("TOTP", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")
    expect(totpAt(RFC_SECRET, stepAt(59_000))).toBe("287082")
    expect(totpAt(RFC_SECRET, stepAt(1_111_111_109_000))).toBe("081804")
    expect(totpAt(RFC_SECRET, stepAt(1_234_567_890_000))).toBe("005924")
    expect(totpAt(RFC_SECRET, stepAt(2_000_000_000_000))).toBe("279037")
  })

  it("round-trips base32 and makes 160-bit secrets", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255])
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes)
    expect(base32Decode(generateTotpSecret())).toHaveLength(20)
    expect(() => base32Decode("NOT-BASE32!")).toThrow()
  })

  it("accepts the current code and one step either side, nothing else", () => {
    const now = 1_700_000_000_000
    const step = stepAt(now)
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step), now)).toBe(step)
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), now)).toBe(step - 1)
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 1), now)).toBe(step + 1)
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 2), now)).toBeNull()
    expect(verifyTotp(RFC_SECRET, "12345", now)).toBeNull()
    expect(verifyTotp(RFC_SECRET, "abcdef", now)).toBeNull()
  })

  it("builds the authenticator link", () => {
    expect(otpauthUri("ABC", "ama@example.com")).toBe("otpauth://totp/BestMart%3Aama%40example.com?secret=ABC&issuer=BestMart&algorithm=SHA1&digits=6&period=30")
  })
})

describe("secret box", () => {
  const app = "an-app-secret-that-is-long-enough-0123456789"
  it("encrypts and decrypts, and refuses tampering or the wrong key", () => {
    const box = encrypt("JBSWY3DPEHPK3PXP", app, "totp")
    expect(box).not.toContain("JBSWY3DPEHPK3PXP")
    expect(decrypt(box, app, "totp")).toBe("JBSWY3DPEHPK3PXP")
    expect(() => decrypt(box, "another-secret-that-is-long-enough-012345", "totp")).toThrow()
    expect(() => decrypt(box, app, "other-purpose")).toThrow()
    const parts = box.split(".")
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith("A") ? "BB" : "AA")
    expect(() => decrypt(parts.join("."), app, "totp")).toThrow()
  })

  it("signs tokens and detects forgeries", () => {
    const token = signToken("user1.1700000000000", app, "2fa")
    expect(verifyToken(token, app, "2fa")).toBe("user1.1700000000000")
    expect(verifyToken(token.replace("user1", "user2"), app, "2fa")).toBeNull()
    expect(verifyToken(token, app, "other")).toBeNull()
    expect(verifyToken("garbage", app, "2fa")).toBeNull()
  })
})
