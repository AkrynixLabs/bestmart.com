import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { roleLabel } from "@/lib/admin/labels"
import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "People" }

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "seller", label: "Sellers" },
  { key: "admins", label: "Admins" },
  { key: "suspended", label: "Suspended" },
] as const
const PAGE_SIZE = 50

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const params = await searchParams
  const q = params.q?.trim().slice(0, 100) ?? ""
  const filter = FILTERS.find((f) => f.key === params.filter)?.key ?? "all"
  const page = Math.max(1, Number(params.page) || 1)
  const where: Prisma.UserWhereInput = {
    ...(filter === "seller" ? { role: "seller" } : filter === "admins" ? { role: { in: ["ops_admin", "super_admin"] } } : filter === "suspended" ? { status: "suspended" } : {}),
    ...(q ? { OR: [{ email: { contains: q.toLowerCase() } }, { name: { contains: q, mode: "insensitive" } }, { store: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  }
  const users = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1, include: { store: { select: { name: true, status: true } } } })
  const link = (changes: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ filter: filter === "all" ? undefined : filter, q: q || undefined, ...changes })) if (v) sp.set(k, v)
    const s = sp.toString()
    return s ? `/admin/users?${s}` : "/admin/users"
  }
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight">People</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter people" className="flex flex-wrap gap-1 text-sm">
          {FILTERS.map((f) => (
            <Link key={f.key} href={link({ filter: f.key === "all" ? undefined : f.key })} aria-current={f.key === filter ? "page" : undefined} className={cn("rounded-full px-3 py-1", f.key === filter ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" action="/admin/users">
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <input type="search" name="q" defaultValue={q} placeholder="Email, name or store" aria-label="Search people" className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm" />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
      </div>
      <ul className="divide-y rounded-xl border">
        {users.slice(0, PAGE_SIZE).map((u) => (
          <li key={u.id}>
            <Link href={`/admin/users/${u.id}`} className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-muted/50">
              <div className="min-w-0">
                <p className="font-medium">{u.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.email}
                  {u.store ? ` · ${u.store.name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {u.status === "suspended" ? <Badge variant="destructive">Suspended</Badge> : null}
                {u.store?.status === "suspended" ? <Badge variant="destructive">Store suspended</Badge> : null}
                <Badge variant="outline">{roleLabel[u.role]}</Badge>
              </div>
            </Link>
          </li>
        ))}
        {users.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">Nobody matches.</li> : null}
      </ul>
      {page > 1 || users.length > PAGE_SIZE ? (
        <nav aria-label="Pages" className="flex justify-between text-sm">
          {page > 1 ? <Link href={link({ page: String(page - 1) })}>← Previous</Link> : <span />}
          {users.length > PAGE_SIZE ? <Link href={link({ page: String(page + 1) })}>Next →</Link> : null}
        </nav>
      ) : null}
    </div>
  )
}
