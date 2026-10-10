import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-semibold text-brand-orange-dark">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted-foreground">The link may be broken, or the page may have moved.</p>
      <Button asChild className="mt-8">
        <Link href="/">Back to the home page</Link>
      </Button>
    </div>
  )
}
