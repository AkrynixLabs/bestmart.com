import Link from "next/link"

import { ADMIN_ROLES, requireRole } from "@/lib/auth/session"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireRole(ADMIN_ROLES, "/admin")
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange-dark">Admin</p>
          <nav aria-label="Admin" className="mt-1 flex gap-4 text-sm font-medium">
            <Link href="/admin" className="hover:text-primary">
              Overview
            </Link>
            <Link href="/admin/seller-applications" className="hover:text-primary">
              Seller applications
            </Link>
          </nav>
        </div>
        <p className="text-sm text-muted-foreground">
          {admin.name} · {admin.role === "super_admin" ? "Super admin" : "Ops admin"}
        </p>
      </div>
      <div className="pt-6">{children}</div>
    </div>
  )
}
