import "server-only"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma/client"
import { env } from "./env"

// node-postgres adapter: works against local Docker Postgres and Neon's
// pooled endpoint alike, so dev and production use the same driver.
// (TutorLane uses the Neon WebSocket adapter, which can't talk to a plain
// local Postgres.)
//
// The client is created on first use, not at import: `next build` imports
// route modules to collect their configuration, and that must work without
// DATABASE_URL (e.g. a Vercel project whose variables aren't set yet).

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function client(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env().DATABASE_URL }) })
  }
  // One client per process (and across hot reloads in dev, so `next dev`
  // doesn't open a new connection pool on every file change).
  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const real = client()
    const value = Reflect.get(real, property, real)
    return typeof value === "function" ? value.bind(real) : value
  },
})
