import "server-only"

import type { Prisma } from "@/lib/generated/prisma/client"
import { enqueueEmail, flushOutboxSoon } from "@/lib/email/outbox"
import { newMessageMessage } from "@/lib/email/templates"
import { prisma } from "@/lib/prisma"
import { appUrl } from "@/lib/site"

import { maskContacts } from "./mask"

export const MAX_MESSAGE_LENGTH = 2000

export class MessageError extends Error {}

/** Contact details show once the buyer has paid for an order from this store. */
export async function contactsUnlocked(buyerId: string, storeId: string): Promise<boolean> {
  return (await prisma.subOrder.count({ where: { storeId, paidAt: { not: null }, order: { userId: buyerId } } })) > 0
}

/** Bodies as the reader should see them. Admins pass unlocked = true. */
export function present<T extends { body: string }>(messages: T[], unlocked: boolean): (T & { masked: boolean })[] {
  return messages.map((m) => {
    if (unlocked) return { ...m, masked: false }
    const { text, masked } = maskContacts(m.body)
    return { ...m, body: text, masked }
  })
}

/** Whether the reader already has unread messages from the other side (then no new email). */
async function hasUnread(tx: Prisma.TransactionClient, conversationId: string, from: "buyer" | "seller", readAt: Date | null) {
  return (await tx.message.count({ where: { conversationId, sender: from, ...(readAt ? { createdAt: { gt: readAt } } : {}) } })) > 0
}

function cleanBody(raw: string): string {
  const body = raw.replace(/\r\n?/g, "\n").trim()
  if (!body) throw new MessageError("Write a message first.")
  if (body.length > MAX_MESSAGE_LENGTH) throw new MessageError(`Messages can be ${MAX_MESSAGE_LENGTH} characters at most.`)
  return body
}

/** A buyer writes to a store (starting the thread if needed). Returns the conversation id. */
export async function sendAsBuyer({ buyerId, storeId, body, productId, orderNumber }: { buyerId: string; storeId: string; body: string; productId?: string | null; orderNumber?: string | null }) {
  const text = cleanBody(body)
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true, status: true, userId: true, user: { select: { name: true, email: true } } } })
  if (!store || store.status !== "active") throw new MessageError("This store isn't taking messages right now.")
  if (store.userId === buyerId) throw new MessageError("You can't message your own store.")
  // Context is only kept when it really belongs to this store (and, for orders, this buyer).
  const product = productId ? await prisma.product.findFirst({ where: { id: productId, storeId }, select: { id: true } }) : null
  const order = orderNumber ? await prisma.order.findFirst({ where: { number: orderNumber, userId: buyerId, subOrders: { some: { storeId } } }, select: { id: true } }) : null
  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: buyerId }, select: { name: true } })
  const id = await prisma.$transaction(async (tx) => {
    const now = new Date()
    const convo = await tx.conversation.upsert({ where: { storeId_buyerId: { storeId, buyerId } }, update: {}, create: { storeId, buyerId } })
    // Email only when the seller has nothing unread yet, so a burst of messages sends one email.
    const sellerCaughtUp = !(await hasUnread(tx, convo.id, "buyer", convo.sellerReadAt))
    await tx.message.create({ data: { conversationId: convo.id, senderId: buyerId, sender: "buyer", body: text, productId: product?.id ?? null, orderId: order?.id ?? null } })
    await tx.conversation.update({ where: { id: convo.id }, data: { lastMessageAt: now, buyerReadAt: now } })
    if (sellerCaughtUp) await enqueueEmail(tx, { to: store.user.email, ...newMessageMessage(store.user.name, buyer.name.split(/\s+/)[0] ?? "A shopper", `${appUrl()}/seller/messages/${convo.id}`) })
    return convo.id
  })
  void flushOutboxSoon()
  return id
}

/** The store replies in an existing thread. */
export async function sendAsSeller({ storeId, sellerId, conversationId, body }: { storeId: string; sellerId: string; conversationId: string; body: string }) {
  const text = cleanBody(body)
  const convo = await prisma.conversation.findFirst({ where: { id: conversationId, storeId }, include: { buyer: { select: { name: true, email: true } }, store: { select: { name: true } } } })
  if (!convo) throw new MessageError("Conversation not found.")
  await prisma.$transaction(async (tx) => {
    const now = new Date()
    const buyerCaughtUp = !(await hasUnread(tx, conversationId, "seller", convo.buyerReadAt))
    await tx.message.create({ data: { conversationId, senderId: sellerId, sender: "seller", body: text } })
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, sellerReadAt: now } })
    if (buyerCaughtUp) await enqueueEmail(tx, { to: convo.buyer.email, ...newMessageMessage(convo.buyer.name, convo.store.name, `${appUrl()}/messages/${conversationId}`) })
  })
  void flushOutboxSoon()
}

export async function markRead(conversationId: string, side: "buyer" | "seller") {
  await prisma.conversation.update({ where: { id: conversationId }, data: side === "buyer" ? { buyerReadAt: new Date() } : { sellerReadAt: new Date() } })
}

export function isUnread(c: { lastMessageAt: Date; buyerReadAt: Date | null; sellerReadAt: Date | null }, side: "buyer" | "seller"): boolean {
  const read = side === "buyer" ? c.buyerReadAt : c.sellerReadAt
  return !read || read < c.lastMessageAt
}
