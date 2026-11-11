import { statusLabel, type SubStatus } from "@/lib/fulfilment/rules"

type Event = { id: string; toStatus: string; fromStatus: string | null; actorKind: string; note: string | null; createdAt: Date }

const who: Record<string, string> = { buyer: "Buyer", seller: "Seller", admin: "BestMart", system: "Automatic" }

/** Status history of one seller's part of an order, oldest first. */
export function Timeline({ events }: { events: Event[] }) {
  if (events.length === 0) return null
  return (
    <ol className="grid gap-2 border-l pl-4 text-sm">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-brand-blue" aria-hidden />
          <p className="font-medium">{e.note ?? statusLabel[e.toStatus as SubStatus]}</p>
          <p className="text-xs text-muted-foreground">
            {who[e.actorKind]} · {e.createdAt.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </li>
      ))}
    </ol>
  )
}
