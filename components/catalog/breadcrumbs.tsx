import Link from "next/link"

import { appUrl } from "@/lib/site"

import { JsonLd } from "./json-ld"

export type Crumb = { name: string; href: string }

/** Visible breadcrumbs plus the matching BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ name: "Home", href: "/" }, ...items]
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((item, i) => (
            <li key={item.href} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden>›</span> : null}
              {i === all.length - 1 ? (
                <span aria-current="page" className="text-foreground">
                  {item.name}
                </span>
              ) : (
                <Link href={item.href} className="hover:underline">
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: `${appUrl()}${item.href}` })),
        }}
      />
    </>
  )
}
