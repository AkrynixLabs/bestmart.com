// Test helper (run with tsx): restores the default delivery bands and road factor.
import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { DEFAULT_BANDS } from "../../../lib/delivery/fee"
import { PrismaClient } from "../../../lib/generated/prisma/client"

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
  try {
    await prisma.platformSettings.upsert({ where: { id: 1 }, update: { deliveryBands: DEFAULT_BANDS, deliveryRoadFactorPct: 130 }, create: { id: 1 } })
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
