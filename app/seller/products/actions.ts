"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { echoValues, type FormState } from "@/lib/actions/state"
import { getCategoryTree } from "@/lib/catalog/categories"
import { attributeField, parseAttributeValues, publishProblems } from "@/lib/catalog/product-rules"
import { syncProductAggregates } from "@/lib/catalog/products"
import { actionSellerStore, ownedProduct } from "@/lib/catalog/seller"
import { childrenOf, effectiveAttributes, isVisible, type CategoryTree } from "@/lib/catalog/tree"
import type { Prisma } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"
import { productSlug } from "@/lib/slug"
import { deletePublic, putPublic } from "@/lib/storage"
import { MAX_PRODUCT_IMAGES, newProductSchema, productDetailsSchema, variantsPayloadSchema } from "@/lib/validation/catalog"
import { fieldErrors } from "@/lib/validation/common"
import { EXTENSION, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/validation/files"

const NOT_ALLOWED: FormState = { error: "Your session has ended or your store isn't active. Please sign in again." }
const NOT_FOUND: FormState = { error: "That product no longer exists." }

function isListable(tree: CategoryTree, categoryId: string) {
  return tree.byId.has(categoryId) && isVisible(tree, categoryId) && childrenOf(tree, categoryId).length === 0
}

function refresh(productId: string, slug: string) {
  revalidatePath(`/seller/products/${productId}`)
  revalidatePath("/seller/products")
  revalidatePath(`/p/${slug}`)
}

// ---------------------------------------------------------------------------
// Create, details, category
// ---------------------------------------------------------------------------

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return NOT_ALLOWED
  const values = echoValues(formData)
  const parsed = newProductSchema.safeParse(values)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }
  const tree = await getCategoryTree()
  if (!isListable(tree, parsed.data.categoryId)) return { fieldErrors: { categoryId: "Choose one of the listed categories." }, values }

  const product = await prisma.product.create({
    data: { storeId: seller.store.id, categoryId: parsed.data.categoryId, title: parsed.data.title, description: "", slug: productSlug(parsed.data.title) },
  })
  redirect(`/seller/products/${product.id}?created=1`)
}

export async function updateProductDetailsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return NOT_ALLOWED
  const product = await ownedProduct(seller.store.id, String(formData.get("productId") ?? ""))
  if (!product) return NOT_FOUND
  const values = echoValues(formData)
  const parsed = productDetailsSchema.safeParse({ title: formData.get("title") ?? "", description: formData.get("description") ?? "" })
  const tree = await getCategoryTree()
  const attributes = effectiveAttributes(tree, product.categoryId)
  const attrs = parseAttributeValues(attributes, (name) => formData.getAll(name).filter((v): v is string => typeof v === "string"))
  const errors = { ...(parsed.success ? {} : fieldErrors(parsed.error)), ...attrs.errors }
  // A live product must keep its required attributes.
  if (product.status === "active") {
    const filled = new Set(attrs.values.map((v) => v.attributeId))
    for (const a of attributes) if (a.isRequired && !filled.has(a.id)) errors[attributeField(a.key)] = `${a.name} is required while the product is live`
  }
  if (!parsed.success || Object.keys(errors).length > 0) return { fieldErrors: errors, values, error: "Please fix the highlighted fields." }
  if (product.status === "active" && parsed.data.description.length < 20) {
    return { fieldErrors: { description: "A live product needs a description of at least 20 characters." }, values }
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { title: parsed.data.title, description: parsed.data.description } })
    await tx.productAttributeValue.deleteMany({ where: { productId: product.id } })
    if (attrs.values.length > 0) await tx.productAttributeValue.createMany({ data: attrs.values.map((v) => ({ ...v, productId: product.id })) })
  })
  refresh(product.id, product.slug)
  return { success: "Details saved." }
}

export async function changeProductCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return NOT_ALLOWED
  const product = await ownedProduct(seller.store.id, String(formData.get("productId") ?? ""))
  if (!product) return NOT_FOUND
  const categoryId = String(formData.get("categoryId") ?? "")
  const tree = await getCategoryTree()
  if (!isListable(tree, categoryId)) return { fieldErrors: { categoryId: "Choose one of the listed categories." } }
  if (categoryId === product.categoryId) return { success: "The category is unchanged." }

  const keep = effectiveAttributes(tree, categoryId).map((a) => a.id)
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { categoryId } })
    // Values for attributes the new category doesn't have are dropped.
    await tx.productAttributeValue.deleteMany({ where: { productId: product.id, attributeId: { notIn: keep } } })
    // A live product whose new category requires missing fields goes back to draft.
    if (product.status === "active") {
      const filled = await tx.productAttributeValue.findMany({ where: { productId: product.id }, select: { attributeId: true } })
      const filledIds = new Set(filled.map((f) => f.attributeId))
      const missing = effectiveAttributes(tree, categoryId).some((a) => a.isRequired && !filledIds.has(a.id))
      if (missing) await tx.product.update({ where: { id: product.id }, data: { status: "draft" } })
    }
  })
  refresh(product.id, product.slug)
  return { success: "Category changed. Check the attributes below for the new category." }
}

// ---------------------------------------------------------------------------
// Options and variants
// ---------------------------------------------------------------------------

export async function saveVariantsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return NOT_ALLOWED
  const product = await ownedProduct(seller.store.id, String(formData.get("productId") ?? ""))
  if (!product) return NOT_FOUND

  let json: unknown
  try {
    json = JSON.parse(String(formData.get("payload") ?? ""))
  } catch {
    return { error: "Something went wrong reading the variants. Please reload the page." }
  }
  const parsed = variantsPayloadSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const row = issue?.path[0] === "variants" && typeof issue.path[1] === "number" ? `Variant ${issue.path[1] + 1}: ` : ""
    return { error: `${row}${issue?.message ?? "Check the variants."}` }
  }
  const { options, variants } = parsed.data
  if (product.status === "active" && !variants.some((v) => v.isActive)) {
    return { error: "A live product needs at least one active variant. Unpublish it first to deactivate them all." }
  }

  const existing = await prisma.productVariant.findMany({ where: { productId: product.id }, select: { id: true } })
  const existingIds = new Set(existing.map((v) => v.id))
  const keptIds = new Set(variants.flatMap((v) => (v.id && existingIds.has(v.id) ? [v.id] : [])))

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: product.id }, data: { options: options as Prisma.InputJsonValue } })
      await tx.productVariant.deleteMany({ where: { productId: product.id, id: { notIn: [...keptIds] } } })
      // Two passes so SKUs or option combinations can be swapped between
      // variants without tripping the unique constraints mid-update.
      for (const id of keptIds) {
        await tx.productVariant.update({ where: { id }, data: { sku: `__tmp_${id}`, optionValues: [`__tmp_${id}`] } })
      }
      for (const [index, v] of variants.entries()) {
        const data = { sku: v.sku, optionValues: v.optionValues, price: v.price, compareAtPrice: v.compareAtPrice ?? null, stock: v.stock, isActive: v.isActive, sortOrder: index }
        if (v.id && keptIds.has(v.id)) await tx.productVariant.update({ where: { id: v.id }, data })
        else await tx.productVariant.create({ data: { ...data, productId: product.id } })
      }
      await syncProductAggregates(tx, product.id)
    })
  } catch (error) {
    logger.error("variant save failed", { productId: product.id, error: error instanceof Error ? error.message : String(error) })
    return { error: "We couldn't save the variants. Please try again." }
  }
  refresh(product.id, product.slug)
  return { success: "Variants saved." }
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function uploadProductImageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return NOT_ALLOWED
  const product = await ownedProduct(seller.store.id, String(formData.get("productId") ?? ""))
  if (!product) return NOT_FOUND
  const file = formData.get("image")
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload." }
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That photo is over 4 MB, even after shrinking. Try a smaller one." }
  const { allowed } = await checkRateLimit("product-image", seller.store.id)
  if (!allowed) return { error: "You've uploaded a lot of photos in the last hour. Please wait a little and try again." }
  const count = await prisma.productImage.count({ where: { productId: product.id } })
  if (count >= MAX_PRODUCT_IMAGES) return { error: `A product can have up to ${MAX_PRODUCT_IMAGES} photos.` }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffImageType(bytes)
  if (!type) return { error: "Upload a JPG, PNG or WebP photo." }
  const dimension = (name: string) => {
    const n = Number(formData.get(name))
    return Number.isInteger(n) && n > 0 && n <= 10_000 ? n : null
  }

  const stored = await putPublic(`products/${seller.store.id}/${product.id}/${randomUUID()}.${EXTENSION[type]}`, bytes, type)
  const last = await prisma.productImage.findFirst({ where: { productId: product.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } })
  await prisma.productImage.create({
    data: { productId: product.id, url: stored.url, key: stored.key, width: dimension("width"), height: dimension("height"), sortOrder: (last?.sortOrder ?? -1) + 1 },
  })
  refresh(product.id, product.slug)
  return { success: "Photo added." }
}

async function ownedImage(imageId: string) {
  const seller = await actionSellerStore()
  if (!seller || !imageId) return null
  const image = await prisma.productImage.findFirst({ where: { id: imageId, product: { storeId: seller.store.id } }, include: { product: true } })
  return image
}

export async function deleteProductImageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const image = await ownedImage(String(formData.get("imageId") ?? ""))
  if (!image) return { error: "That photo no longer exists." }
  if (image.product.status === "active") {
    const count = await prisma.productImage.count({ where: { productId: image.productId } })
    if (count <= 1) return { error: "A live product needs at least one photo. Add another first, or unpublish." }
  }
  await prisma.productImage.delete({ where: { id: image.id } })
  try {
    await deletePublic(image.key)
  } catch (error) {
    // The row is gone, so the photo is no longer shown; an orphaned file is harmless.
    logger.warn("photo file delete failed", { key: image.key, error: error instanceof Error ? error.message : String(error) })
  }
  refresh(image.productId, image.product.slug)
  return { success: "Photo removed." }
}

export async function moveProductImageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const image = await ownedImage(String(formData.get("imageId") ?? ""))
  if (!image) return { error: "That photo no longer exists." }
  const direction = formData.get("direction") === "up" ? "up" : "down"
  const images = await prisma.productImage.findMany({ where: { productId: image.productId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } })
  const index = images.findIndex((i) => i.id === image.id)
  const target = direction === "up" ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= images.length) return {}
  const order = images.map((i) => i.id)
  ;[order[index], order[target]] = [order[target]!, order[index]!]
  await prisma.$transaction(order.map((id, sortOrder) => prisma.productImage.update({ where: { id }, data: { sortOrder } })))
  refresh(image.productId, image.product.slug)
  return {}
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export async function setProductStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await actionSellerStore()
  if (!seller) return NOT_ALLOWED
  const product = await ownedProduct(seller.store.id, String(formData.get("productId") ?? ""))
  if (!product) return NOT_FOUND
  const intent = String(formData.get("intent") ?? "")

  if (intent === "publish") {
    if (product.blockedAt) return { error: "An admin has blocked this listing. Contact support to have it reviewed." }
    const tree = await getCategoryTree()
    const [imageCount, variants, filled] = await Promise.all([
      prisma.productImage.count({ where: { productId: product.id } }),
      prisma.productVariant.findMany({ where: { productId: product.id }, select: { price: true, stock: true, isActive: true } }),
      prisma.productAttributeValue.findMany({ where: { productId: product.id }, select: { attributeId: true } }),
    ])
    const problems = publishProblems({
      title: product.title,
      description: product.description,
      categoryListable: isListable(tree, product.categoryId),
      imageCount,
      variants,
      requiredAttributes: effectiveAttributes(tree, product.categoryId).filter((a) => a.isRequired),
      filledAttributeIds: filled.map((f) => f.attributeId),
    })
    if (problems.length > 0) return { error: `Not ready to publish: ${problems.join(" ")}` }
    await prisma.product.update({ where: { id: product.id }, data: { status: "active", publishedAt: product.publishedAt ?? new Date() } })
    refresh(product.id, product.slug)
    return { success: "Published. Shoppers can see it now." }
  }

  const next = intent === "unpublish" ? "draft" : intent === "archive" ? "archived" : intent === "restore" ? "draft" : null
  if (!next) return { error: "Unknown action." }
  await prisma.product.update({ where: { id: product.id }, data: { status: next } })
  refresh(product.id, product.slug)
  return { success: next === "archived" ? "Archived. It's hidden from shoppers and from your main list." : "Moved to drafts. Shoppers can no longer see it." }
}
