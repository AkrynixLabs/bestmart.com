import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Compose } from "@/components/messages/compose"
import { Thread } from "@/components/messages/thread"
import { requireSellerStore } from "@/lib/catalog/seller"
import { contactsUnlocked, markRead, present } from "@/lib/messages/service"
import { prisma } from "@/lib/prisma"
import { reviewerName } from "@/lib/reviews/rules"

import { sendSellerMessageAction } from "../actions"

export const metadata: Metadata = { title: "Conversation", robots: { index: false } }

export default async function SellerThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { store } = await requireSellerStore(`/seller/messages/${id}`)
  const convo = await prisma.conversation.findFirst({
    where: { id, storeId: store.id },
    include: {
      buyer: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 500, include: { product: { select: { title: true, slug: true } }, order: { select: { number: true } } } },
    },
  })
  if (!convo) notFound()
  const unlocked = await contactsUnlocked(convo.buyerId, store.id)
  await markRead(convo.id, "seller")
  return (
    <div className="grid gap-6">
      <div>
        <Link href="/seller/messages" className="text-sm text-muted-foreground hover:underline">
          ← Messages
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{reviewerName(convo.buyer.name)}</h1>
      </div>
      <Thread messages={present(convo.messages, unlocked)} mine="seller" unlocked={unlocked} />
      {store.status === "active" ? <Compose action={sendSellerMessageAction} hidden={{ conversationId: convo.id }} label="Reply" /> : null}
    </div>
  )
}
