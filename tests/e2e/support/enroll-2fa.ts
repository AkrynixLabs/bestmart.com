// Test helper (run with tsx): turns on two-factor for an admin with a fresh
// secret, stored exactly as the app stores it, and prints the secret.
import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { encrypt } from "../../../lib/auth/secret-box"
import { generateTotpSecret } from "../../../lib/auth/totp"
import { PrismaClient } from "../../../lib/generated/prisma/client"

async function main() {
  const email = process.argv[2]
  if (!email) throw new Error("usage: tsx tests/e2e/support/enroll-2fa.ts <email>")
  const appSecret = process.env.AUTH_SECRET
  if (!appSecret) throw new Error("AUTH_SECRET is not set")
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
  try {
    const secret = generateTotpSecret()
    await prisma.user.update({ where: { email }, data: { totpSecret: encrypt(secret, appSecret, "totp-secret"), totpEnabledAt: new Date(), totpLastStep: null } })
    process.stdout.write(secret)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
