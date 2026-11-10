import "server-only"

import type { Prisma } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

import { retryDelayMinutes } from "./retry"
import { sendEmail, type Email } from "./send"

// Transactional outbox. Write the email with `enqueueEmail(tx, ...)` inside
// the same transaction as the change it announces (so it can't be lost or
// sent for a change that rolled back), then call `flushOutbox()` after the
// transaction. Failed sends are retried with backoff by later flushes (the
// daily cron and normal traffic).

const MAX_ATTEMPTS = 6

export async function enqueueEmail(tx: Prisma.TransactionClient, email: Email) {
  await tx.emailOutbox.create({ data: email })
}

export async function flushOutbox(limit = 50): Promise<{ sent: number; failed: number }> {
  const due = await prisma.emailOutbox.findMany({ where: { status: "pending", sendAfter: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: limit })
  let sent = 0
  let failed = 0
  for (const email of due) {
    // Claim it, so two flushes running at once don't both send it.
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id: email.id, status: "pending", attempts: email.attempts },
      data: { attempts: { increment: 1 }, sendAfter: new Date(Date.now() + retryDelayMinutes(email.attempts + 1) * 60_000) },
    })
    if (claimed.count !== 1) continue
    try {
      await sendEmail({ to: email.to, subject: email.subject, html: email.html, text: email.text })
      await prisma.emailOutbox.update({ where: { id: email.id }, data: { status: "sent", sentAt: new Date(), lastError: null } })
      sent++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const giveUp = email.attempts + 1 >= MAX_ATTEMPTS
      await prisma.emailOutbox.update({ where: { id: email.id }, data: { lastError: message.slice(0, 1000), ...(giveUp ? { status: "failed" } : {}) } })
      logger.error("outbox email failed", { id: email.id, attempts: email.attempts + 1, giveUp, error: message })
      failed++
    }
  }
  return { sent, failed }
}

/** Best-effort flush right after a change; never throws. */
export async function flushOutboxSoon() {
  try {
    await flushOutbox(20)
  } catch (error) {
    logger.error("outbox flush failed", { error: error instanceof Error ? error.message : String(error) })
  }
}
