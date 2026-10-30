import "server-only"
import { cache } from "react"

import { prisma } from "@/lib/prisma"

/**
 * The single settings row. The migration creates it; upsert keeps a fresh or
 * test database working even if that row is missing.
 */
export const getPlatformSettings = cache(async () => {
  return prisma.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
})
