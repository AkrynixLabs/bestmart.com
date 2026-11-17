import Link from "next/link"

import { requireSellerStore } from "@/lib/catalog/seller"

const links = [
  { href: "/seller", label: "Dashboard" },
  { href: "/seller/orders", label: "Orders" },
  { href: "/seller/products", label: "Products" },
  { href: "/seller/earnings", label: "Earnings" },
  { href: "/seller/reviews", label: "Reviews" },
  { href: "/seller/messages", label: "Messages" },
  { href: "/seller/settings", label: "Pickup location" },
  { href: "/seller/categories", label: "Suggest a category" },
]

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const { store } = await requireSellerStore("/seller")
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange-dark">Seller</p>
          <nav aria-label="Seller" className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-primary">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link href={`/s/${store.slug}`} className="truncate text-sm text-muted-foreground hover:underline">
          {store.name} · view store
        </Link>
      </div>
      {store.status !== "active" ? (
        <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Your store is suspended. Your products are hidden and can&apos;t be changed. Contact support for details.
        </p>
      ) : null}
      <div className="pt-6">{children}</div>
    </div>
  )
}
