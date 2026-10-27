import "server-only"

import type { Prisma } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

type AuditEntry = {
  actorId: string | null
  action: string
  entityType: string
  entityId: string
  metadata?: Prisma.InputJsonValue
  ip?: string
}

/**
 * Records a sensitive action. Pass `tx` to write inside the same transaction
 * as the change itself (so the log can't disagree with the data).
 */
export async function audit(entry: AuditEntry, tx: Prisma.TransactionClient = prisma): Promise<void> {
  await tx.auditLog.create({ data: entry })
  logger.info("audit", { action: entry.action, entityType: entry.entityType, entityId: entry.entityId, actorId: entry.actorId })
}
