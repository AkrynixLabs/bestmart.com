"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { echoValues, type FormState } from "@/lib/actions/state"
import { audit } from "@/lib/audit"
import { ADMIN_ROLES, actionUser } from "@/lib/auth/session"
import { getCategoryTree, invalidateCategories } from "@/lib/catalog/categories"
import { categorySlugTaken, createCategory, placement, uniqueCategorySlug } from "@/lib/catalog/category-admin"
import { attributeKeyConflict, moveError } from "@/lib/catalog/tree"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { putPublic } from "@/lib/storage"
import { attributeKeyFrom, attributeSchema, categorySchema } from "@/lib/validation/catalog"
import { fieldErrors } from "@/lib/validation/common"
import { EXTENSION, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/validation/files"

const NOT_ALLOWED: FormState = { error: "You don't have permission to do that." }

async function uploadCategoryImage(file: FormDataEntryValue | null): Promise<{ url?: string; error?: string }> {
  if (!(file instanceof File) || file.size === 0) return {}
  if (file.size > MAX_UPLOAD_BYTES) return { error: "The image must be 4 MB or smaller" }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffImageType(bytes)
  if (!type) return { error: "Upload a JPG, PNG or WebP image" }
  const { url } = await putPublic(`categories/${randomUUID()}.${EXTENSION[type]}`, bytes, type)
  return { url }
}

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return NOT_ALLOWED
  const values = echoValues(formData)
  const parsed = categorySchema.safeParse(values)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }
  const data = parsed.data
  const id = typeof formData.get("id") === "string" && formData.get("id") ? String(formData.get("id")) : null

  // Only the Super Admin changes money settings.
  const existing = id ? await prisma.category.findUnique({ where: { id } }) : null
  if (id && !existing) return { error: "That category no longer exists." }
  const commissionChanged = (existing?.commissionBps ?? null) !== data.commissionPercent
  if (commissionChanged && admin.role !== "super_admin") {
    return { fieldErrors: { commissionPercent: "Only the Super Admin can change commission." }, values }
  }

  const tree = await getCategoryTree()
  if (existing && existing.parentId !== data.parentId) {
    const problem = moveError(tree, existing.id, data.parentId)
    if (problem) return { fieldErrors: { parentId: problem }, values }
  }
  const place = await placement(data.parentId)
  if ("error" in place) return { fieldErrors: { parentId: place.error }, values }
  const { depth, parentPath } = place

  if (data.slug && (await categorySlugTaken(data.slug, existing?.id))) return { fieldErrors: { slug: "Another category uses (or used) this address." }, values }
  const slug = data.slug ?? (existing ? existing.slug : await uniqueCategorySlug(data.name))

  const image = await uploadCategoryImage(formData.get("image"))
  if (image.error) return { fieldErrors: { image: image.error }, values }
  const removeImage = formData.get("removeImage") === "on"

  const ip = await clientIp()
  const fields = {
    name: data.name,
    slug,
    parentId: data.parentId,
    description: data.description ?? null,
    status: data.status,
    commissionBps: data.commissionPercent,
    sortOrder: data.sortOrder,
    seoTitle: data.seoTitle ?? null,
    seoDescription: data.seoDescription ?? null,
    ...(image.url ? { imageUrl: image.url } : removeImage ? { imageUrl: null } : {}),
  }

  let savedId: string
  try {
    savedId = await prisma.$transaction(async (tx) => {
      if (!existing) {
        const newId = await createCategory(tx, fields, { depth, parentPath })
        await audit({ actorId: admin.id, action: "category.created", entityType: "category", entityId: newId, metadata: { name: data.name, parentId: data.parentId }, ip }, tx)
        return newId
      }

      await tx.category.update({ where: { id: existing.id }, data: fields })
      if (existing.slug !== slug) {
        // Old links keep working: remember the old slug, release the new one.
        await tx.categorySlugRedirect.deleteMany({ where: { slug } })
        await tx.categorySlugRedirect.upsert({ where: { slug: existing.slug }, update: { categoryId: existing.id }, create: { slug: existing.slug, categoryId: existing.id } })
      }
      if (existing.parentId !== data.parentId) {
        // Re-path the whole subtree under its new parent.
        const rows = await tx.category.findMany({ where: { path: { startsWith: existing.path } }, select: { id: true, path: true, depth: true } })
        const newPath = `${parentPath}${existing.id}/`
        for (const row of rows) {
          await tx.category.update({
            where: { id: row.id },
            data: { path: newPath + row.path.slice(existing.path.length), depth: row.depth - existing.depth + depth },
          })
        }
      }
      await audit(
        {
          actorId: admin.id,
          action: "category.updated",
          entityType: "category",
          entityId: existing.id,
          metadata: {
            ...(existing.slug !== slug ? { slug: { from: existing.slug, to: slug } } : {}),
            ...(existing.parentId !== data.parentId ? { parentId: { from: existing.parentId, to: data.parentId } } : {}),
            ...(existing.status !== data.status ? { status: { from: existing.status, to: data.status } } : {}),
            ...(commissionChanged ? { commissionBps: { from: existing.commissionBps, to: data.commissionPercent } } : {}),
          },
          ip,
        },
        tx,
      )
      return existing.id
    })
  } catch (error) {
    logger.error("category save failed", { error: error instanceof Error ? error.message : String(error) })
    return { error: "We couldn't save the category. Please try again.", values }
  }

  invalidateCategories()
  revalidatePath("/", "layout")
  if (!existing) redirect(`/admin/categories/${savedId}?created=1`)
  return { success: "Category saved." }
}

export async function deleteCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return NOT_ALLOWED
  const id = String(formData.get("id") ?? "")
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { children: true, products: true } } } })
  if (!category) return { error: "That category no longer exists." }
  if (category._count.children > 0) return { error: "Move or delete its subcategories first." }
  if (category._count.products > 0) return { error: `It has ${category._count.products} product(s). Hide it instead, so their links keep working.` }

  const ip = await clientIp()
  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id } })
    await audit({ actorId: admin.id, action: "category.deleted", entityType: "category", entityId: id, metadata: { name: category.name, slug: category.slug }, ip }, tx)
  })
  invalidateCategories()
  revalidatePath("/", "layout")
  redirect("/admin/categories?deleted=1")
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

export async function saveAttributeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return NOT_ALLOWED
  const values = echoValues(formData)
  const parsed = attributeSchema.safeParse(values)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }
  const data = parsed.data
  const categoryId = String(formData.get("categoryId") ?? "")
  const attributeId = String(formData.get("attributeId") ?? "") || null

  const tree = await getCategoryTree()
  if (!tree.byId.has(categoryId)) return { error: "That category no longer exists." }
  const existing = attributeId ? await prisma.categoryAttribute.findUnique({ where: { id: attributeId } }) : null
  if (attributeId && (!existing || existing.categoryId !== categoryId)) return { error: "That attribute no longer exists." }

  // The key is fixed once created: products and filter links refer to it.
  const key = existing ? existing.key : (data.key ?? attributeKeyFrom(data.name))
  const conflict = attributeKeyConflict(tree, categoryId, key, existing?.id)
  if (conflict) return { fieldErrors: { key: `"${key}" is already used by ${conflict} (on the same branch). Choose another key.` }, values }

  if (existing) {
    const inUse = await prisma.productAttributeValue.count({ where: { attributeId: existing.id } })
    if (inUse > 0 && existing.type !== data.type) {
      return { fieldErrors: { type: `${inUse} product(s) already use this attribute, so its type can't change. Create a new attribute instead.` }, values }
    }
    const removed = existing.options.filter((o) => !data.options.includes(o))
    if (removed.length > 0) {
      const using = await prisma.productAttributeValue.count({ where: { attributeId: existing.id, textValues: { hasSome: removed } } })
      if (using > 0) return { fieldErrors: { options: `${using} product(s) use ${removed.map((r) => `"${r}"`).join(", ")}. Keep those choices, or ask the sellers to change them first.` }, values }
    }
  }

  const ip = await clientIp()
  const fields = { name: data.name, type: data.type, unit: data.unit ?? null, options: data.options, isRequired: data.isRequired, isFilterable: data.isFilterable, sortOrder: data.sortOrder }
  await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.categoryAttribute.update({ where: { id: existing.id }, data: fields })
      : await tx.categoryAttribute.create({ data: { ...fields, key, categoryId } })
    await audit({ actorId: admin.id, action: existing ? "category_attribute.updated" : "category_attribute.created", entityType: "category_attribute", entityId: saved.id, metadata: { categoryId, key, type: data.type }, ip }, tx)
  })
  invalidateCategories()
  revalidatePath(`/admin/categories/${categoryId}`)
  return existing ? { success: "Attribute saved." } : { success: `Attribute "${data.name}" added.` }
}

export async function deleteAttributeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionUser(ADMIN_ROLES)
  if (!admin) return NOT_ALLOWED
  const attributeId = String(formData.get("attributeId") ?? "")
  const attribute = await prisma.categoryAttribute.findUnique({ where: { id: attributeId }, include: { _count: { select: { values: true } } } })
  if (!attribute) return { error: "That attribute no longer exists." }
  if (attribute._count.values > 0 && formData.get("confirm") !== "on") {
    return { error: `${attribute._count.values} product(s) have a value for "${attribute.name}". Tick the box to delete it and those values.` }
  }
  const ip = await clientIp()
  await prisma.$transaction(async (tx) => {
    await tx.categoryAttribute.delete({ where: { id: attributeId } })
    await audit({ actorId: admin.id, action: "category_attribute.deleted", entityType: "category_attribute", entityId: attributeId, metadata: { key: attribute.key, values: attribute._count.values }, ip }, tx)
  })
  invalidateCategories()
  revalidatePath(`/admin/categories/${attribute.categoryId}`)
  return { success: `Attribute "${attribute.name}" deleted.` }
}
