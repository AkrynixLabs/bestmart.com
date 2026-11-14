import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { roleLabel } from "@/lib/admin/labels"
import { ADMIN_ROLES, isAdmin, requireRole } from "@/lib/auth/session"
import { formatGhs } from "@/lib/money"
import { prisma } from "@/lib/prisma"

import { ResetTwoFactorForm, RoleForm, StatusForm } from "./forms"

export const metadata: Metadata = { title: "Person" }

const DONE: Record<string, string> = {
  suspended: "Account suspended. They're signed out and can't sign in.",
  reinstated: "Account reinstated.",
  store_suspended: "Store suspended. Its products are hidden and it can't sell.",
  store_reinstated: "Store reinstated. Its live products are visible again.",
  promoted: "Now an ops admin. They'll set up two-factor sign-in on their first visit to the admin area.",
  demoted: "Admin access removed.",
  "2fa_reset": "Two-factor reset. They'll set it up again on their next visit to the admin area.",
}

export default async function AdminUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const [{ id }, { done }] = await Promise.all([params, searchParams])
  const me = await requireRole(ADMIN_ROLES, `/admin/users/${id}`)
  const user = await prisma.user.findUnique({
    where: { id },
    include: { store: { select: { id: true, name: true, slug: true, status: true } }, _count: { select: { orders: true } } },
  })
  if (!user) notFound()
  const [recent, audits] = await Promise.all([
    prisma.order.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 5, select: { number: true, grandTotal: true, status: true, createdAt: true } }),
    prisma.auditLog.findMany({ where: { OR: [{ entityId: id }, { actorId: id }, ...(user.store ? [{ entityId: user.store.id }] : [])] }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
  ])
  const self = me.id === user.id
  const superAdmin = me.role === "super_admin"
  const canSuspend = !self && user.role !== "super_admin" && (!isAdmin(user.role) || superAdmin)

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">
          ← People
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          <Badge variant="outline">{roleLabel[user.role]}</Badge>
          {user.status === "suspended" ? <Badge variant="destructive">Suspended</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.email}
          {user.phone ? ` · ${user.phone}` : ""} · joined {user.createdAt.toLocaleDateString("en-GH", { dateStyle: "medium" })}
          {user.lastLoginAt ? ` · last sign-in ${user.lastLoginAt.toLocaleDateString("en-GH", { dateStyle: "medium" })}` : ""}
          {isAdmin(user.role) ? ` · two-factor ${user.totpEnabledAt ? "on" : "not set up"}` : ""}
        </p>
      </div>
      {done && DONE[done] ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          {DONE[done]}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="grid content-start gap-3 rounded-xl border p-4" aria-label="Account">
          <h2 className="font-semibold">Account</h2>
          {canSuspend ? (
            <StatusForm userId={user.id} kind="user" suspended={user.status === "suspended"} label={user.status === "suspended" ? "Reinstate account" : "Suspend account"} />
          ) : (
            <p className="text-sm text-muted-foreground">{self ? "This is you." : "Only the Super Admin can manage admin accounts."}</p>
          )}
          {superAdmin && !self && (user.role === "customer" || user.role === "ops_admin") ? (
            <RoleForm userId={user.id} toRole={user.role === "customer" ? "ops_admin" : "customer"} label={user.role === "customer" ? "Make ops admin" : "Remove admin access"} />
          ) : null}
          {superAdmin && !self && isAdmin(user.role) && user.totpEnabledAt ? <ResetTwoFactorForm userId={user.id} /> : null}
        </section>

        {user.store ? (
          <section className="grid content-start gap-3 rounded-xl border p-4" aria-label="Store">
            <h2 className="font-semibold">
              Store:{" "}
              <Link href={`/s/${user.store.slug}`} className="hover:underline">
                {user.store.name}
              </Link>{" "}
              {user.store.status === "suspended" ? <Badge variant="destructive">Suspended</Badge> : null}
            </h2>
            <StatusForm userId={user.id} kind="store" suspended={user.store.status === "suspended"} label={user.store.status === "suspended" ? "Reinstate store" : "Suspend store"} />
          </section>
        ) : null}
      </div>

      <section>
        <h2 className="font-semibold">Recent orders ({user._count.orders})</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-xl border text-sm">
            {recent.map((o) => (
              <li key={o.number} className="flex justify-between gap-3 p-3">
                <Link href={`/admin/orders/${o.number}`} className="hover:underline">
                  {o.number} · {o.status.replace("_", " ")}
                </Link>
                <span className="tabular-nums">{formatGhs(o.grandTotal)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold">Recent activity in the audit log</h2>
        {audits.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-xl border text-sm">
            {audits.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {a.action} <span className="text-muted-foreground">by {a.actor?.name ?? "the system"}</span>
                </span>
                <span className="text-xs text-muted-foreground">{a.createdAt.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
