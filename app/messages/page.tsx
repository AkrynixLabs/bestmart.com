import type { Metadata } from "next"
import Link from "next/link"
import { MessageSquare } from "lucide-react"

import { requireUser } from "@/lib/auth/session"
import { isUnread } from "@/lib/messages/service"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Messages", robots: { index: false } }

export default async function MessagesPage() {
  const user = await requireUser("/messages")
  const threads = await prisma.conversation.findMany({
    where: { buyerId: user.id },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: { store: { select: { name: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { sender: true } } },
  })
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <MessageSquare className="size-6 text-primary" aria-hidden /> Messages
      </h1>
      {threads.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No messages yet. Use &ldquo;Message the seller&rdquo; on a product or store page to ask a question.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border">
          {threads.map((t) => {
            const unread = isUnread(t, "buyer")
            return (
              <li key={t.id}>
                <Link href={`/messages/${t.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                  <span className={unread ? "font-semibold" : ""}>{t.store.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {unread ? <span className="rounded-full bg-brand-orange px-2 py-0.5 font-medium text-white">New</span> : null}
                    {t.messages[0]?.sender === "buyer" ? "You: " : ""}
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
