import { describe, expect, it } from "vitest"

import { parseEnv } from "@/lib/env"

describe("parseEnv", () => {
  it("accepts a minimal valid config and applies defaults", () => {
    const env = parseEnv({ DATABASE_URL: "postgresql://u:p@localhost:5433/db", AUTH_SECRET: "x".repeat(32), RESEND_API_KEY: "" })
    expect(env.LOG_LEVEL).toBe("info")
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000")
    expect(env.RESEND_API_KEY).toBeUndefined() // empty string counts as unset
  })

  it("fails with a readable message naming the bad key", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://nope", AUTH_SECRET: "x".repeat(32) })).toThrow(/DATABASE_URL/)
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/)
    expect(() => parseEnv({ DATABASE_URL: "postgresql://u:p@h/db", AUTH_SECRET: "short" })).toThrow(/AUTH_SECRET/)
  })
})

describe("E2E test mode", () => {
  const base = { DATABASE_URL: "postgresql://u:p@localhost:5433/db", AUTH_SECRET: "x".repeat(32) }
  it("only accepts the exact value 1", () => {
    expect(parseEnv({ ...base, E2E_TEST_MODE: "1" }).E2E_TEST_MODE).toBe("1")
    expect(() => parseEnv({ ...base, E2E_TEST_MODE: "true" })).toThrow(/E2E_TEST_MODE/)
  })
})
