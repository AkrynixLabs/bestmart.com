import "server-only"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma/client"
import { env } from "./env"

// node-postgres adapter: works against local Docker Postgres and Neon's
// pooled endpoint alike, so dev and production use the same driver.
// (TutorLane uses the Neon WebSocket adapter, which can't talk to a plain
// local Postgres.)

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL })
  return new PrismaClient({ adapter })
}

// Reuse one client across hot reloads in dev so `next dev` doesn't open a
// new connection pool on every file change.
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
