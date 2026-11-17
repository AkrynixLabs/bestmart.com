import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Compose } from "@/components/messages/compose"
import { Thread } from "@/components/messages/thread"
import { requireUser } from "@/lib/auth/session"
import { contactsUnlocked, markRead, present } from "@/lib/messages/service"
import { prisma } from "@/lib/prisma"

import { sendBuyerMessageAction } from "../actions"

export const metadata: Metadata = { title: "Conversation", robots: { index: false } }

export default async function BuyerThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser(`/messages/${id}`)
  const convo = await prisma.conversation.findFirst({
    where: { id, buyerId: user.id },
    include: {
      store: { select: { id: true, name: true, slug: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 500, include: { product: { select: { title: true, slug: true } }, order: { select: { number: true } } } },
    },
  })
  if (!convo) notFound()
  const unlocked = await contactsUnlocked(user.id, convo.storeId)
  await markRead(convo.id, "buyer")
  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/messages" className="text-sm text-muted-foreground hover:underline">
          ← Messages
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          <Link href={`/s/${convo.store.slug}`} className="hover:underline">
            {convo.store.name}
          </Link>
        </h1>
      </div>
      <Thread messages={present(convo.messages, unlocked)} mine="buyer" unlocked={unlocked} />
      <Compose action={sendBuyerMessageAction} hidden={{ storeId: convo.store.id }} label="Reply" />
    </div>
  )
}
