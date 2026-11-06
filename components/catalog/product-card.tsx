import Image from "next/image"
import Link from "next/link"
import { ImageOff } from "lucide-react"

import type { ProductCard as Card } from "@/lib/catalog/products"
import { formatGhs } from "@/lib/money"

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  const onSale = product.compareAtPrice !== null && product.compareAtPrice > product.minPrice
  return (
    <Link href={`/p/${product.slug}`} className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <div className="relative aspect-square bg-muted">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 25vw, 50vw"
            priority={priority}
            className="object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageOff className="size-8 text-muted-foreground" aria-hidden />
          </div>
        )}
        {!product.inStock ? <span className="absolute left-2 top-2 rounded bg-background/90 px-2 py-0.5 text-xs font-semibold">Sold out</span> : null}
        {onSale && product.inStock ? <span className="absolute left-2 top-2 rounded bg-brand-orange px-2 py-0.5 text-xs font-semibold text-white">Sale</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{product.title}</p>
        <p className="mt-auto pt-1">
          <span className="font-bold">
            {product.minPrice !== product.maxPrice ? "From " : ""}
            {formatGhs(product.minPrice)}
          </span>
          {onSale ? <span className="ml-2 text-xs text-muted-foreground line-through">{formatGhs(product.compareAtPrice!)}</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{product.store.name}</p>
      </div>
    </Link>
  )
}

export function ProductGrid({ products, emptyText = "No products here yet." }: { products: Card[]; emptyText?: string }) {
  if (products.length === 0) return <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{emptyText}</p>
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 4} />
        </li>
      ))}
    </ul>
  )
}
