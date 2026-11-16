import type { Metadata } from "next"
import Link from "next/link"
import { Heart } from "lucide-react"

import { ProductGrid } from "@/components/catalog/product-card"
import { requireUser } from "@/lib/auth/session"
import { getProductCards, isProductPublic } from "@/lib/catalog/products"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Saved", robots: { index: false } }

export default async function SavedPage() {
  const user = await requireUser("/saved")
  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { product: { select: { id: true, status: true, blockedAt: true, categoryId: true, store: { select: { status: true } } } } },
  })
  // Only products shoppers can still see; the rest are hidden until they're back.
  const visible: string[] = []
  for (const i of items) if (await isProductPublic(i.product)) visible.push(i.product.id)
  const cards = await getProductCards(visible)
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Heart className="size-6 text-brand-orange" aria-hidden /> Saved
      </h1>
      {items.length > visible.length ? <p className="mt-1 text-sm text-muted-foreground">{items.length - visible.length} saved product(s) aren&apos;t available right now.</p> : null}
      <div className="mt-6">
        {cards.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nothing saved yet. Tap <strong>Save</strong> on a product to keep it here.{" "}
            <Link href="/" className="font-medium text-primary hover:underline">
              Start browsing
            </Link>
          </p>
        ) : (
          <ProductGrid products={cards} />
        )}
      </div>
    </div>
  )
}
