import { categoryLabel, flatten, MAX_CATEGORY_DEPTH, moveError, type CategoryTree } from "@/lib/catalog/tree"

/** Categories that can be a parent of `forId` (or of a new category). */
export function parentOptions(tree: CategoryTree, forId?: string): [string, string][] {
  return flatten(tree)
    .filter((c) => c.depth < MAX_CATEGORY_DEPTH && (!forId || moveError(tree, forId, c.id) === null))
    .map((c) => [c.id, categoryLabel(tree, c.id) + (c.status === "hidden" ? " (hidden)" : "")])
}
