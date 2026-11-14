import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { requireRole } from "@/lib/auth/session"
import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Audit log" }

const PAGE_SIZE = 50

/** Opaque "before" cursor: base64url of [ISO time, id]. */
function readCursor(raw?: string): { createdAt: Date; id: string } | null {
  if (!raw) return null
  try {
    const [t, id] = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as [string, string]
    const createdAt = new Date(t)
    return Number.isNaN(createdAt.getTime()) || typeof id !== "string" ? null : { createdAt, id }
  } catch {
    return null
  }
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ action?: string; actor?: string; entity?: string; before?: string }> }) {
  await requireRole(["super_admin"], "/admin/audit")
  const params = await searchParams
  const action = params.action?.trim().slice(0, 60) ?? ""
  const actor = params.actor?.trim().toLowerCase().slice(0, 120) ?? ""
  const entity = params.entity?.trim().slice(0, 60) ?? ""
  const cursor = readCursor(params.before)
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action: { contains: action } } : {}),
    ...(actor ? { actor: { email: { contains: actor } } } : {}),
    ...(entity ? { entityId: entity } : {}),
    ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}),
  }
  const rows = await prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1, include: { actor: { select: { name: true, email: true } } } })
  const last = rows[PAGE_SIZE - 1]
  const nextCursor = rows.length > PAGE_SIZE && last ? Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.id])).toString("base64url") : null
  const filters = new URLSearchParams(Object.entries({ action, actor, entity }).filter(([, v]) => v))

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sensitive actions: approvals, refunds, payouts, role and settings changes, document views. Newest first; entries can&apos;t be edited.</p>
      </div>
      <form action="/admin/audit" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="grid gap-1">
          Action contains
          <input name="action" defaultValue={action} placeholder="e.g. payout, refund" className="h-9 w-44 rounded-md border border-input bg-background px-2" />
        </label>
        <label className="grid gap-1">
          By (email)
          <input name="actor" defaultValue={actor} className="h-9 w-52 rounded-md border border-input bg-background px-2" />
        </label>
        <label className="grid gap-1">
          Record id
          <input name="entity" defaultValue={entity} className="h-9 w-52 rounded-md border border-input bg-background px-2" />
        </label>
        <Button type="submit" size="sm" variant="outline">
          Filter
        </Button>
        {filters.size ? (
          <Link href="/admin/audit" className="pb-2 text-muted-foreground hover:underline">
            Clear
          </Link>
        ) : null}
      </form>
      <ul className="divide-y rounded-xl border text-sm">
        {rows.slice(0, PAGE_SIZE).map((r) => (
          <li key={r.id} className="grid gap-1 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{r.action}</span>
              <span className="text-xs text-muted-foreground">{r.createdAt.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "medium" })}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {r.actor ? `${r.actor.name} (${r.actor.email})` : "System"} · {r.entityType} {r.entityId}
              {r.ip ? ` · ${r.ip}` : ""}
            </p>
            {r.metadata ? <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/60 p-2 text-xs">{JSON.stringify(r.metadata, null, 1).slice(0, 2000)}</pre> : null}
          </li>
        ))}
        {rows.length === 0 ? <li className="p-6 text-center text-muted-foreground">No entries.</li> : null}
      </ul>
      {nextCursor ? (
        <div>
          <Button asChild variant="outline">
            <Link href={`/admin/audit?${new URLSearchParams([...filters, ["before", nextCursor]])}`}>Older entries</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
