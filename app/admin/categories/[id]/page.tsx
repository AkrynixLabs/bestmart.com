import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth/session"
import { getCategoryTree } from "@/lib/catalog/categories"
import { ancestry, categoryLabel, childrenOf, MAX_CATEGORY_DEPTH } from "@/lib/catalog/tree"
import { formatBps } from "@/lib/money"
import { getPlatformSettings } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import { ATTRIBUTE_TYPES } from "@/lib/validation/catalog"

import { AttributeForm, DeleteAttributeForm } from "../attribute-forms"
import { CategoryForm, DeleteCategoryForm } from "../category-form"
import { parentOptions } from "../parent-options"

export const metadata: Metadata = { title: "Edit category" }

const typeLabel = Object.fromEntries(ATTRIBUTE_TYPES) as Record<string, string>

export default async function EditCategoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, { created }] = await Promise.all([params, searchParams])
  const [tree, settings, user] = await Promise.all([getCategoryTree(), getPlatformSettings(), getCurrentUser()])
  const category = tree.byId.get(id)
  if (!category) notFound()

  const chain = ancestry(tree, id)
  const inherited = chain.slice(0, -1).flatMap((c) => c.attributes.map((a) => ({ ...a, from: c.name })))
  const usage = await prisma.productAttributeValue.groupBy({ by: ["attributeId"], where: { attributeId: { in: category.attributes.map((a) => a.id) } }, _count: { _all: true } })
  const usedBy = new Map(usage.map((u) => [u.attributeId, u._count._all]))
  const children = childrenOf(tree, id, { includeHidden: true })

  return (
    <div className="grid gap-10">
      <div>
        <Link href="/admin/categories" className="text-sm text-muted-foreground hover:underline">
          ← Categories
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{category.name}</h1>
          {category.status === "hidden" ? <Badge variant="outline">Hidden</Badge> : null}
          <Link href={`/c/${category.slug}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            View on storefront <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{categoryLabel(tree, id)}</p>
        {created ? (
          <p role="status" className="mt-4 rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
            Category created. Add attributes below so sellers can describe their products and shoppers can filter.
          </p>
        ) : null}
      </div>

      <section aria-labelledby="category-details" className="grid max-w-3xl gap-4">
        <h2 id="category-details" className="text-lg font-semibold">
          Details
        </h2>
        <CategoryForm
          initial={{
            id: category.id,
            name: category.name,
            slug: category.slug,
            parentId: category.parentId ?? "",
            description: category.description ?? "",
            status: category.status,
            commissionPercent: category.commissionBps === null ? "" : formatBps(category.commissionBps),
            sortOrder: String(category.sortOrder),
            seoTitle: category.seoTitle ?? "",
            seoDescription: category.seoDescription ?? "",
            imageUrl: category.imageUrl,
          }}
          parentOptions={parentOptions(tree, category.id)}
          canEditCommission={user?.role === "super_admin"}
          platformCommission={formatBps(settings.commissionBps)}
        />
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold">Attributes</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Fields sellers fill in for products here and in every subcategory. Filterable ones appear as filters on the category page.
          </p>
        </div>

        {inherited.length > 0 ? (
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-medium">Inherited</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {inherited.map((a) => (
                <li key={a.id}>
                  <Badge variant="outline">
                    {a.name} · from {a.from}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ul className="grid gap-3">
          {category.attributes.map((a) => (
            <li key={a.id} className="rounded-xl border">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.key} · {typeLabel[a.type]}
                    {a.unit ? ` (${a.unit})` : ""}
                  </span>
                  {a.isRequired ? <Badge variant="secondary">Required</Badge> : null}
                  {a.isFilterable ? <Badge variant="outline">Filter</Badge> : null}
                  <span className="ml-auto text-xs text-muted-foreground">{usedBy.get(a.id) ?? 0} product(s)</span>
                </summary>
                <div className="grid gap-6 border-t p-4">
                  <AttributeForm
                    categoryId={category.id}
                    usedBy={usedBy.get(a.id) ?? 0}
                    initial={{
                      id: a.id,
                      key: a.key,
                      name: a.name,
                      type: a.type,
                      unit: a.unit ?? "",
                      options: a.options.join(", "),
                      isRequired: a.isRequired,
                      isFilterable: a.isFilterable,
                      sortOrder: String(a.sortOrder),
                    }}
                  />
                  <DeleteAttributeForm attributeId={a.id} usedBy={usedBy.get(a.id) ?? 0} />
                </div>
              </details>
            </li>
          ))}
        </ul>

        <section aria-labelledby="add-attribute" className="rounded-xl border border-dashed p-4">
          <h3 id="add-attribute" className="mb-4 font-medium">
            Add an attribute
          </h3>
          <AttributeForm categoryId={category.id} />
        </section>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Subcategories</h2>
          {category.depth < MAX_CATEGORY_DEPTH ? (
            <Link href={`/admin/categories/new?parent=${category.id}`} className="text-sm font-medium text-primary hover:underline">
              Add subcategory
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Third level: no further subcategories.</span>
          )}
        </div>
        {children.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {children.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/categories/${c.id}`} className="inline-flex rounded-full border px-3 py-1 text-sm hover:bg-muted">
                  {c.name}
                  {c.status === "hidden" ? " (hidden)" : ""}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">None.</p>
        )}
      </section>

      <section className="grid max-w-3xl gap-3 border-t pt-6">
        <h2 className="text-lg font-semibold">Delete</h2>
        <DeleteCategoryForm id={category.id} />
      </section>
    </div>
  )
}
