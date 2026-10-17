import { describe, expect, it } from "vitest"

import { redact } from "@/lib/logger"

describe("redact", () => {
  it("hides secrets by key name, recursively", () => {
    const out = redact({
      userId: "u1",
      headers: { authorization: "Bearer abc", Cookie: "session=1" },
      nested: [{ password: "p", paystackSecretKey: "sk_live_x", ghanaCardNumber: "GHA-1" }],
    })
    expect(out).toEqual({
      userId: "u1",
      headers: { authorization: "[REDACTED]", Cookie: "[REDACTED]" },
      nested: [{ password: "[REDACTED]", paystackSecretKey: "[REDACTED]", ghanaCardNumber: "[REDACTED]" }],
    })
  })

  it("serialises errors including their cause", () => {
    const out = redact(new Error("outer", { cause: new Error("inner") })) as Record<string, unknown>
    expect(out.message).toBe("outer")
    expect((out.cause as Record<string, unknown>).message).toBe("inner")
  })

  it("leaves primitives alone", () => {
    expect(redact("x")).toBe("x")
    expect(redact(null)).toBeNull()
  })
})
