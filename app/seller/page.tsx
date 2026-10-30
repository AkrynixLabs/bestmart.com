import type { Metadata } from "next"
import { Package, ShoppingBag, Wallet } from "lucide-react"

import { requireRole } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { regionLabel } from "@/lib/validation/common"

export const metadata: Metadata = { title: "Seller dashboard", robots: { index: false } }

const upcoming = [
  { icon: Package, title: "Products and stock", body: "List products with photos, sizes and colours, and track stock." },
  { icon: ShoppingBag, title: "Orders", body: "See paid orders, mark them shipped, and follow them to delivery." },
  { icon: Wallet, title: "Earnings and payouts", body: "Track pending and available balances, paid to your MoMo or bank." },
]

export default async function SellerDashboardPage() {
  const user = await requireRole(["seller"], "/seller")
  const store = await prisma.store.findUnique({ where: { userId: user.id } })

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-sm text-muted-foreground">Seller dashboard</p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{store?.name ?? "Your store"}</h1>
      {store ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {store.city}, {regionLabel[store.region]} · Payouts to {store.payoutProvider} ending {store.payoutAccountNumber.slice(-4)}
        </p>
      ) : null}
      <div className="mt-8 rounded-xl border border-dashed p-6">
        <p className="font-semibold">Your store is approved. Product listing opens in the next update.</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {upcoming.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-lg bg-muted p-4">
              <Icon className="size-5 text-brand-blue" aria-hidden />
              <p className="mt-2 font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
