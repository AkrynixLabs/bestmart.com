import Image from "next/image"
import Link from "next/link"
import { Search } from "lucide-react"

import { site } from "@/lib/site"

import { CartLink } from "./cart-link"
import { UserMenu } from "./user-menu"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label={`${site.name} home`}>
          <Image src="/brand/logo.png" alt="" width={84} height={56} priority className="h-12 w-auto" />
        </Link>

        <form action="/search" role="search" className="relative hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            name="q"
            maxLength={100}
            placeholder="Search products and sellers"
            aria-label="Search products and sellers"
            className="h-10 w-full rounded-md border border-input bg-muted/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:bg-background"
          />
        </form>

        <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm font-medium">
          <Link href="/search" className="inline-flex rounded-md p-2 hover:bg-muted md:hidden" aria-label="Search">
            <Search className="size-5" aria-hidden />
          </Link>
          <Link href="/#categories" className="hidden rounded-md px-3 py-2 hover:bg-muted lg:inline-flex">
            Categories
          </Link>
          <Link href="/sell/apply" className="hidden rounded-md px-3 py-2 text-brand-orange-dark hover:bg-muted sm:inline-flex">
            Sell on {site.name}
          </Link>
          <CartLink />
          <UserMenu />
        </nav>
      </div>
    </header>
  )
}
