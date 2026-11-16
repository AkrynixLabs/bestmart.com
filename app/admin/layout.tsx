import { headers } from "next/headers"
import Link from "next/link"

import { ADMIN_ROLES, requireRole } from "@/lib/auth/session"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The proxy passes the requested path; only a plain admin path is trusted.
  const requested = (await headers()).get("x-bm-admin-path") ?? ""
  const admin = await requireRole(ADMIN_ROLES, /^\/admin(\/[A-Za-z0-9\-_/]*)?$/.test(requested) ? requested : "/admin")
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange-dark">Admin</p>
          <nav aria-label="Admin" className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
            <Link href="/admin" className="hover:text-primary">
              Overview
            </Link>
            <Link href="/admin/seller-applications" className="hover:text-primary">
              Seller applications
            </Link>
            <Link href="/admin/categories" className="hover:text-primary">
              Categories
            </Link>
            <Link href="/admin/products" className="hover:text-primary">
              Products
            </Link>
            <Link href="/admin/orders" className="hover:text-primary">
              Orders
            </Link>
            <Link href="/admin/disputes" className="hover:text-primary">
              Problems
            </Link>
            <Link href="/admin/reviews" className="hover:text-primary">
              Reviews
            </Link>
            <Link href="/admin/users" className="hover:text-primary">
              People
            </Link>
            {admin.role === "super_admin" ? (
              <>
                <Link href="/admin/payouts" className="hover:text-primary">
                  Payouts
                </Link>
                <Link href="/admin/reports" className="hover:text-primary">
                  Reports
                </Link>
                <Link href="/admin/audit" className="hover:text-primary">
                  Audit log
                </Link>
                <Link href="/admin/settings" className="hover:text-primary">
                  Settings
                </Link>
              </>
            ) : null}
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
