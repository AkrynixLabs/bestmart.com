import type { Metadata } from "next"
import Link from "next/link"

import { getCurrentUser } from "@/lib/auth/session"
import { getCategoryTree } from "@/lib/catalog/categories"
import { formatBps } from "@/lib/money"
import { getPlatformSettings } from "@/lib/platform-settings"

import { CategoryForm } from "../category-form"
import { parentOptions } from "../parent-options"

export const metadata: Metadata = { title: "New category" }

export default async function NewCategoryPage({ searchParams }: { searchParams: Promise<{ parent?: string }> }) {
  const { parent } = await searchParams
  const [tree, settings, user] = await Promise.all([getCategoryTree(), getPlatformSettings(), getCurrentUser()])
  const options = parentOptions(tree)
  const parentId = parent && options.some(([id]) => id === parent) ? parent : ""

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <Link href="/admin/categories" className="text-sm text-muted-foreground hover:underline">
          ← Categories
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">New category</h1>
      </div>
      <CategoryForm
        initial={{ name: "", slug: "", parentId, description: "", status: "active", commissionPercent: "", sortOrder: "0", seoTitle: "", seoDescription: "", imageUrl: null }}
        parentOptions={options}
        canEditCommission={user?.role === "super_admin"}
        platformCommission={formatBps(settings.commissionBps)}
      />
    </div>
  )
}
