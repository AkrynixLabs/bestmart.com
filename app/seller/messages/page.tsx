import type { Metadata } from "next"
import Link from "next/link"

import { requireSellerStore } from "@/lib/catalog/seller"
import { isUnread } from "@/lib/messages/service"
import { prisma } from "@/lib/prisma"
import { reviewerName } from "@/lib/reviews/rules"

export const metadata: Metadata = { title: "Messages", robots: { index: false } }

export default async function SellerMessagesPage() {
  const { store } = await requireSellerStore("/seller/messages")
  const threads = await prisma.conversation.findMany({ where: { storeId: store.id }, orderBy: { lastMessageAt: "desc" }, take: 100, include: { buyer: { select: { name: true } } } })
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">Questions from shoppers. Contact details stay hidden until the shopper has paid for an order from you.</p>
      </div>
      {threads.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No messages yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {threads.map((t) => {
            const unread = isUnread(t, "seller")
            return (
              <li key={t.id}>
                <Link href={`/seller/messages/${t.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                  <span className={unread ? "font-semibold" : ""}>{reviewerName(t.buyer.name)}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {unread ? <span className="rounded-full bg-brand-orange px-2 py-0.5 font-medium text-white">New</span> : null}
                    {t.lastMessageAt.toLocaleDateString("en-GH", { dateStyle: "medium" })}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
