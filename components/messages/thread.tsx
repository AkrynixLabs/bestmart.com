import Link from "next/link"
import { ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"

export type ThreadMessage = {
  id: string
  sender: "buyer" | "seller"
  body: string
  masked: boolean
  createdAt: Date
  product: { title: string; slug: string } | null
  order: { number: string } | null
}

/** A conversation, oldest first; "mine" is the side the reader is on. */
export function Thread({ messages, mine, unlocked }: { messages: ThreadMessage[]; mine: "buyer" | "seller"; unlocked: boolean }) {
  return (
    <div className="grid gap-3">
      {!unlocked ? (
        <p className="flex gap-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
          Phone numbers, emails and links are hidden until there&apos;s a paid order. Paying on BestMart keeps you covered by buyer protection.
        </p>
      ) : null}
      <ol className="grid gap-3" aria-label="Messages">
        {messages.map((m) => (
          <li key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-2 text-sm", m.sender === mine ? "justify-self-end bg-primary text-primary-foreground" : "justify-self-start bg-muted")}>
            {m.product || m.order ? (
              <p className={cn("mb-1 text-xs", m.sender === mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
                About{" "}
                {m.product ? (
                  <Link href={`/p/${m.product.slug}`} className="underline">
                    {m.product.title}
                  </Link>
                ) : (
                  `order ${m.order!.number}`
                )}
              </p>
            ) : null}
            <p className="whitespace-pre-line break-words">{m.body}</p>
            <p className={cn("mt-1 text-[11px]", m.sender === mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
              {m.createdAt.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
              {m.masked ? " · contact details hidden" : ""}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}
