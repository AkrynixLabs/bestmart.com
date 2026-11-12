import "server-only"
import { randomBytes } from "node:crypto"

import { enqueueEmail, flushOutboxSoon } from "@/lib/email/outbox"
import { payoutFailedMessage, payoutSentMessage } from "@/lib/email/templates"
import { logger } from "@/lib/logger"
import { paymentProvider } from "@/lib/payments"
import type { Bank } from "@/lib/payments/types"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

import { isPayoutDay, maskAccount, matchBank, MOMO_CODES, payoutReference, recipientKey } from "./rules"

// Weekly payouts. Money moves in this order:
//   1. prepare: a draft batch lists every store whose available balance is at
//      least the minimum (indicative amounts);
//   2. approve (Super Admin): the batch is claimed, each amount is recomputed
//      from the ledger under a row lock and debited (`payout` entry), all at once;
//   3. send: a Paystack Transfer per payout; the webhook (or an immediate
//      result) marks it paid, or failed, which credits the money back.

export class PayoutError extends Error {}

/** Each store's available balance (pesewas). */
export async function availableBalances(storeIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.ledgerEntry.groupBy({ by: ["storeId"], where: { bucket: "available", ...(storeIds ? { storeId: { in: storeIds } } : {}) }, _sum: { amount: true } })
  return new Map(rows.map((r) => [r.storeId, r._sum.amount ?? 0]))
}

async function banksOrNull(): Promise<Bank[] | null> {
  try {
    return await paymentProvider().listBanks()
  } catch (error) {
    logger.error("could not load bank list", { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

/** The Paystack bank code for a store, resolving (and saving) a typed bank name if it can. */
async function bankCodeFor(store: { id: string; payoutMethod: string; payoutProvider: string; payoutBankCode: string | null }, banks: () => Promise<Bank[] | null>): Promise<{ code: string } | { issue: string }> {
  if (store.payoutMethod === "mobile_money") {
    const code = MOMO_CODES[store.payoutProvider]
    return code ? { code } : { issue: `Unknown MoMo network "${store.payoutProvider}"` }
  }
  if (store.payoutBankCode) return { code: store.payoutBankCode }
  const list = await banks()
  if (!list) return { issue: "Couldn't load the bank list from Paystack; try again" }
  const match = matchBank(store.payoutProvider, list)
  if (!match) return { issue: `Bank "${store.payoutProvider}" not recognised: choose it below` }
  await prisma.store.update({ where: { id: store.id }, data: { payoutBankCode: match.code } })
  return { code: match.code }
}

export async function prepareBatch(preparedById: string | null) {
  const open = await prisma.payoutBatch.findFirst({ where: { status: { in: ["draft", "sending"] } } })
  if (open) throw new PayoutError(open.status === "draft" ? "There's already a draft batch: review it or cancel it first." : "The last batch is still being sent.")
  const settings = await getPlatformSettings()
  const balances = await availableBalances()
  const eligible = [...balances].filter(([, amount]) => amount >= settings.payoutMinimum)
  if (eligible.length === 0) throw new PayoutError(`No seller has at least the minimum (${(settings.payoutMinimum / 100).toFixed(2)} cedis) available.`)
  const stores = await prisma.store.findMany({ where: { id: { in: eligible.map(([id]) => id) }, status: "active" } })

  let bankList: Bank[] | null | undefined
  const banks = async () => (bankList === undefined ? (bankList = await banksOrNull()) : bankList)
  const rows = []
  for (const store of stores) {
    const code = await bankCodeFor(store, banks)
    rows.push({ storeId: store.id, amount: balances.get(store.id)!, issue: "issue" in code ? code.issue : null })
  }
  if (rows.length === 0) throw new PayoutError("No active seller is due a payout.")
  const now = new Date()
  return prisma.payoutBatch.create({
    data: {
      preparedById,
      total: rows.filter((r) => !r.issue).reduce((s, r) => s + r.amount, 0),
      payouts: { create: rows.map((r) => ({ ...r, reference: payoutReference(now, randomBytes(5).toString("hex")) })) },
    },
  })
}

export async function setStoreBankCode(storeId: string, bankCode: string) {
  const banks = await paymentProvider().listBanks()
  if (!banks.some((b) => b.code === bankCode)) throw new PayoutError("Choose a bank from the list.")
  await prisma.$transaction(async (tx) => {
    await tx.store.update({ where: { id: storeId }, data: { payoutBankCode: bankCode, payoutRecipientCode: null, payoutRecipientKey: null } })
    await tx.payout.updateMany({ where: { storeId, status: "pending" }, data: { issue: null } })
    const draft = await tx.payoutBatch.findFirst({ where: { status: "draft" }, include: { payouts: true } })
    if (draft) await tx.payoutBatch.update({ where: { id: draft.id }, data: { total: draft.payouts.filter((p) => !p.issue || p.storeId === storeId).reduce((s, p) => s + p.amount, 0) } })
  })
}

export async function cancelBatch(batchId: string) {
  const claimed = await prisma.payoutBatch.updateMany({ where: { id: batchId, status: "draft" }, data: { status: "cancelled" } })
  if (claimed.count !== 1) throw new PayoutError("Only a draft batch can be cancelled.")
  await prisma.payout.updateMany({ where: { batchId }, data: { status: "cancelled" } })
}

/** Approves a draft: debits each seller (fresh amounts, under a lock), then sends the transfers. */
export async function approveBatch(batchId: string, approvedById: string) {
  const settings = await getPlatformSettings()
  const claimed = await prisma.payoutBatch.updateMany({ where: { id: batchId, status: "draft" }, data: { status: "sending", approvedById, approvedAt: new Date() } })
  if (claimed.count !== 1) throw new PayoutError("This batch was already approved or cancelled.")

  const payouts = await prisma.payout.findMany({ where: { batchId, status: "pending" } })
  for (const payout of payouts) {
    await prisma.$transaction(async (tx) => {
      // Lock the store so a refund or another debit can't change its balance mid-way.
      await tx.$queryRaw`SELECT "id" FROM "stores" WHERE "id" = ${payout.storeId} FOR UPDATE`
      const sum = await tx.ledgerEntry.aggregate({ where: { storeId: payout.storeId, bucket: "available" }, _sum: { amount: true } })
      const current = sum._sum.amount ?? 0
      const amount = Math.min(payout.amount, current)
      if (payout.issue || amount < settings.payoutMinimum) {
        await tx.payout.update({ where: { id: payout.id }, data: { status: "cancelled", failureReason: payout.issue ?? "Balance fell below the minimum before approval" } })
        return
      }
      await tx.payout.update({ where: { id: payout.id }, data: { amount, status: "processing" } })
      await tx.ledgerEntry.create({ data: { storeId: payout.storeId, payoutId: payout.id, kind: "payout", amount: -amount, bucket: "available", note: `Payout ${payout.reference}` } })
    })
  }
  const sending = await prisma.payout.findMany({ where: { batchId, status: "processing" } })
  await prisma.payoutBatch.update({ where: { id: batchId }, data: { total: sending.reduce((s, p) => s + p.amount, 0) } })
  for (const payout of sending) await sendPayout(payout.id)
  await finishBatchIfDone(batchId)
  await flushOutboxSoon()
}

async function sendPayout(payoutId: string) {
  const payout = await prisma.payout.findUniqueOrThrow({ where: { id: payoutId }, include: { store: true } })
  const store = payout.store
  try {
    const code = await bankCodeFor(store, banksOrNull)
    if ("issue" in code) return await markFailed(payoutId, code.issue)
    const key = recipientKey({ payoutMethod: store.payoutMethod, bankCode: code.code, payoutAccountNumber: store.payoutAccountNumber, payoutAccountName: store.payoutAccountName })
    let recipient = store.payoutRecipientKey === key ? store.payoutRecipientCode : null
    if (!recipient) {
      recipient = await paymentProvider().createRecipient({ kind: store.payoutMethod, bankCode: code.code, accountName: store.payoutAccountName, accountNumber: store.payoutAccountNumber })
      await prisma.store.update({ where: { id: store.id }, data: { payoutRecipientCode: recipient, payoutRecipientKey: key } })
    }
    const result = await paymentProvider().transfer({ amount: payout.amount, recipientCode: recipient, reference: payout.reference, reason: `BestMart payout: ${store.name}` })
    await prisma.payout.update({ where: { id: payoutId }, data: { transferCode: result.transferCode } })
    if (result.status === "success") await markPaid(payoutId)
    else if (result.status === "failed") await markFailed(payoutId, result.failureReason ?? "The transfer was rejected")
    // "pending": the transfer webhook finishes it.
  } catch (error) {
    // We can't tell whether Paystack accepted it; leave it processing for the webhook or a person.
    const message = error instanceof Error ? error.message : String(error)
    logger.error("payout transfer error: check in Paystack", { payoutId, reference: payout.reference, error: message })
    await prisma.payout.update({ where: { id: payoutId }, data: { failureReason: `Couldn't confirm the transfer: ${message.slice(0, 200)}` } })
  }
}

const destination = (store: { payoutMethod: string; payoutProvider: string; payoutAccountNumber: string }) =>
  `${store.payoutMethod === "mobile_money" ? `${store.payoutProvider} MoMo` : store.payoutProvider} ${maskAccount(store.payoutAccountNumber)}`

async function markPaid(payoutId: string) {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.payout.updateMany({ where: { id: payoutId, status: "processing" }, data: { status: "paid", paidAt: new Date(), failureReason: null } })
    if (claimed.count !== 1) return
    const p = await tx.payout.findUniqueOrThrow({ where: { id: payoutId }, include: { store: { include: { user: { select: { name: true, email: true } } } } } })
    await enqueueEmail(tx, { to: p.store.user.email, ...payoutSentMessage(p.store.user.name, p.store.name, p.amount, destination(p.store)) })
  })
}

/** A failed (or reversed) transfer: the money goes back to the seller's available balance. */
async function markFailed(payoutId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.payout.updateMany({ where: { id: payoutId, status: { in: ["processing", "paid"] } }, data: { status: "failed", failureReason: reason } })
    if (claimed.count !== 1) return
    const p = await tx.payout.findUniqueOrThrow({ where: { id: payoutId }, include: { store: { include: { user: { select: { name: true, email: true } } } } } })
    const debited = await tx.ledgerEntry.count({ where: { payoutId, kind: "payout" } })
    if (debited > 0) await tx.ledgerEntry.create({ data: { storeId: p.storeId, payoutId, kind: "adjustment", amount: p.amount, bucket: "available", note: `Payout ${p.reference} failed; returned to balance` } })
    await enqueueEmail(tx, { to: p.store.user.email, ...payoutFailedMessage(p.store.user.name, p.store.name, p.amount, reason) })
  })
}

async function finishBatchIfDone(batchId: string) {
  const open = await prisma.payout.count({ where: { batchId, status: { in: ["pending", "processing"] } } })
  if (open === 0) await prisma.payoutBatch.updateMany({ where: { id: batchId, status: "sending" }, data: { status: "completed" } })
}

/** Paystack transfer webhooks. */
export async function handleTransferEvent(event: string, data: Record<string, unknown>) {
  const reference = typeof data.reference === "string" ? data.reference : null
  if (!reference) return
  const payout = await prisma.payout.findUnique({ where: { reference }, select: { id: true, batchId: true } })
  if (!payout) return
  if (event === "transfer.success") await markPaid(payout.id)
  else if (event === "transfer.failed" || event === "transfer.reversed") {
    const reason = typeof data.reason === "string" && data.reason ? data.reason : event === "transfer.reversed" ? "The transfer was reversed" : "The transfer failed"
    await markFailed(payout.id, reason)
  }
  await finishBatchIfDone(payout.batchId)
  await flushOutboxSoon()
}

/** Drafts the weekly batch on the payout day (once per day; skipped if a batch is open or nobody is due). */
export async function maybePrepareWeeklyBatch(now = new Date()): Promise<boolean> {
  const settings = await getPlatformSettings()
  if (!isPayoutDay(now, settings.payoutWeekday)) return false
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (await prisma.payoutBatch.count({ where: { createdAt: { gte: startOfDay } } })) return false
  try {
    await prepareBatch(null)
    return true
  } catch (error) {
    if (error instanceof PayoutError) return false
    throw error
  }
}
