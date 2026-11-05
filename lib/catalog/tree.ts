// Pure helpers over the category tree (no database access), so they can be
// unit-tested and reused by the storefront, seller and admin pages.

export const MAX_CATEGORY_DEPTH = 2 // 0-based: three levels (root > child > grandchild)

export type AttributeType = "text" | "number" | "select" | "multiselect" | "boolean"

export type TreeAttribute = {
  id: string
  categoryId: string
  key: string
  name: string
  type: AttributeType
  unit: string | null
  options: string[]
  isRequired: boolean
  isFilterable: boolean
  sortOrder: number
}

export type TreeCategory = {
  id: string
  parentId: string | null
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  depth: number
  sortOrder: number
  status: "active" | "hidden"
  commissionBps: number | null
  seoTitle: string | null
  seoDescription: string | null
  attributes: TreeAttribute[]
}

export type CategoryTree = {
  all: TreeCategory[]
  byId: Map<string, TreeCategory>
  bySlug: Map<string, TreeCategory>
  children: Map<string | null, TreeCategory[]>
}

const byOrder = (a: TreeCategory, b: TreeCategory) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)

export function buildTree(categories: TreeCategory[]): CategoryTree {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const bySlug = new Map(categories.map((c) => [c.slug, c]))
  const children = new Map<string | null, TreeCategory[]>()
  for (const category of categories) {
    const list = children.get(category.parentId) ?? []
    list.push(category)
    children.set(category.parentId, list)
  }
  for (const list of children.values()) list.sort(byOrder)
  return { all: categories, byId, bySlug, children }
}

export function childrenOf(tree: CategoryTree, id: string | null, { includeHidden = false } = {}): TreeCategory[] {
  const list = tree.children.get(id) ?? []
  return includeHidden ? list : list.filter((c) => c.status === "active")
}

/** Root first, ending with the category itself. */
export function ancestry(tree: CategoryTree, id: string): TreeCategory[] {
  const chain: TreeCategory[] = []
  let current = tree.byId.get(id)
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parentId ? tree.byId.get(current.parentId) : undefined
  }
  return chain
}

/** The category and everything below it. */
export function subtreeIds(tree: CategoryTree, id: string, { includeHidden = false } = {}): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    out.push(current)
    for (const child of childrenOf(tree, current, { includeHidden })) walk(child.id)
  }
  if (tree.byId.has(id)) walk(id)
  return out
}

/** A category is shown to shoppers only if it and every ancestor are active. */
export function isVisible(tree: CategoryTree, id: string): boolean {
  const chain = ancestry(tree, id)
  return chain.length > 0 && chain.every((c) => c.status === "active")
}

export function visibleIds(tree: CategoryTree): string[] {
  return tree.all.filter((c) => isVisible(tree, c.id)).map((c) => c.id)
}

/** Attributes that apply to products in this category: inherited first (root down), then its own. */
export function effectiveAttributes(tree: CategoryTree, id: string): TreeAttribute[] {
  return ancestry(tree, id).flatMap((c) => [...c.attributes].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
}

/** The nearest commission override on the way up, else the platform default. */
export function effectiveCommissionBps(tree: CategoryTree, id: string, platformDefault: number): number {
  const chain = ancestry(tree, id)
  for (let i = chain.length - 1; i >= 0; i--) {
    const bps = chain[i]?.commissionBps
    if (bps !== null && bps !== undefined) return bps
  }
  return platformDefault
}

/** Height of the subtree below a category (0 for a leaf). */
export function subtreeHeight(tree: CategoryTree, id: string): number {
  const kids = tree.children.get(id) ?? []
  return kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => subtreeHeight(tree, k.id)))
}

/**
 * Why a category can't move under `newParentId` (null = becomes a root), or
 * null if it can. Guards against cycles and the depth cap.
 */
export function moveError(tree: CategoryTree, id: string, newParentId: string | null): string | null {
  if (newParentId === null) return subtreeHeight(tree, id) > MAX_CATEGORY_DEPTH ? "That would make the tree too deep." : null
  if (newParentId === id) return "A category can't be its own parent."
  const parent = tree.byId.get(newParentId)
  if (!parent) return "The parent category doesn't exist."
  if (ancestry(tree, newParentId).some((c) => c.id === id)) return "A category can't move inside its own subcategory."
  if (parent.depth + 1 + subtreeHeight(tree, id) > MAX_CATEGORY_DEPTH) return "Categories can be at most three levels deep."
  return null
}

/**
 * Attribute keys must be unique along every branch, so a product never has
 * two fields with the same key. Returns the conflicting category's name.
 */
export function attributeKeyConflict(tree: CategoryTree, categoryId: string, key: string, ignoreAttributeId?: string): string | null {
  const related = [...ancestry(tree, categoryId), ...subtreeIds(tree, categoryId, { includeHidden: true }).map((cid) => tree.byId.get(cid)!)]
  for (const category of related) {
    if (category.attributes.some((a) => a.key === key && a.id !== ignoreAttributeId)) return category.name
  }
  return null
}

/** "Fashion › Women › Dresses" */
export function categoryLabel(tree: CategoryTree, id: string): string {
  return ancestry(tree, id)
    .map((c) => c.name)
    .join(" › ")
}

/** Categories a seller can list in: active, visible and without subcategories. */
export function listableCategories(tree: CategoryTree): { id: string; label: string }[] {
  return tree.all
    .filter((c) => isVisible(tree, c.id) && childrenOf(tree, c.id).length === 0)
    .map((c) => ({ id: c.id, label: categoryLabel(tree, c.id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Depth-first order with depth, for indented admin lists and pickers. */
export function flatten(tree: CategoryTree, { includeHidden = true } = {}): TreeCategory[] {
  const out: TreeCategory[] = []
  const walk = (parentId: string | null) => {
    for (const c of childrenOf(tree, parentId, { includeHidden })) {
      out.push(c)
      walk(c.id)
    }
  }
  walk(null)
  return out
}
