import Link from "next/link"

import { requireUser } from "@/lib/auth/session"

const links = [
  { href: "/account", label: "Profile & security" },
  { href: "/orders", label: "Orders" },
  { href: "/account/addresses", label: "Delivery addresses" },
  { href: "/sell/apply", label: "Sell on BestMart" },
]

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account")
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[220px_1fr]">
      <aside>
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="truncate font-semibold">{user.name}</p>
        <nav aria-label="Account" className="mt-4 grid gap-1 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 hover:bg-muted">
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
