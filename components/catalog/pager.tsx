import Link from "next/link"

import { Button } from "@/components/ui/button"
import { withParams, type SearchParams } from "@/lib/catalog/filters"

/** "Next page" for keyset (cursor) or numbered (relevance) results. */
export function Pager({ pathname, params, nextCursor, nextPage, isFirst }: { pathname: string; params: SearchParams; nextCursor: string | null; nextPage: number | null; isFirst: boolean }) {
  const next = nextCursor ? withParams(pathname, params, { after: nextCursor }) : nextPage ? withParams(pathname, params, { page: String(nextPage) }) : null
  if (!next && isFirst) return null
  return (
    <nav aria-label="More results" className="flex flex-wrap justify-center gap-3 pt-4">
      {!isFirst ? (
        <Button asChild variant="outline">
          <Link href={withParams(pathname, params, {})}>Back to first page</Link>
        </Button>
      ) : null}
      {next ? (
        <Button asChild>
          <Link href={next} rel="next">
            Next page
          </Link>
        </Button>
      ) : null}
    </nav>
  )
}
