// Test helper (run with tsx): moves a fulfilment timestamp of every part of
// an order N days into the past, so the daily job treats it as due.
//   tsx tests/e2e/support/time-travel.ts <order number> <shipBy|shippedAt|deliveredAt> <days ago>
import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../../../lib/generated/prisma/client"

async function main() {
  const [number, field, daysAgo] = process.argv.slice(2)
  if (!number || !field || !daysAgo || !["shipBy", "shippedAt", "deliveredAt"].includes(field)) throw new Error("usage: <order number> <shipBy|shippedAt|deliveredAt> <days ago>")
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
  try {
    const when = new Date(Date.now() - Number(daysAgo) * 24 * 60 * 60 * 1000)
    const result = await prisma.subOrder.updateMany({ where: { order: { number } }, data: { [field]: when } })
    if (result.count === 0) throw new Error(`order ${number} not found`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
