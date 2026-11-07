// Test helper (run with tsx): makes an order's stock reservation expire now.
import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../../../lib/generated/prisma/client"

async function main() {
  const number = process.argv[2]
  if (!number) throw new Error("usage: tsx tests/e2e/support/expire-order.ts <order number>")
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
  try {
    const result = await prisma.order.updateMany({ where: { number }, data: { reservedUntil: new Date(Date.now() - 60_000) } })
    if (result.count !== 1) throw new Error(`order ${number} not found`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
