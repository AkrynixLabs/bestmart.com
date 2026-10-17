import { describe, expect, it } from "vitest"

import { parseEnv } from "@/lib/env"

describe("parseEnv", () => {
  it("accepts a minimal valid config and applies defaults", () => {
    const env = parseEnv({ DATABASE_URL: "postgresql://u:p@localhost:5433/db" })
    expect(env.LOG_LEVEL).toBe("info")
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000")
  })

  it("fails with a readable message naming the bad key", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://nope" })).toThrow(/DATABASE_URL/)
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/)
  })
})
