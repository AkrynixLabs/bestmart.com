-- Trigram matching for typo-tolerant product search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('active', 'hidden');

-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('text', 'number', 'select', 'multiselect', 'boolean');

-- CreateEnum
CREATE TYPE "CategorySuggestionStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'active', 'archived');

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CategoryStatus" NOT NULL DEFAULT 'active',
    "commissionBps" INTEGER,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_slug_redirects" (
    "slug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_slug_redirects_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "category_attributes" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "unit" TEXT,
    "options" TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_suggestions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "status" "CategorySuggestionStatus" NOT NULL DEFAULT 'pending',
    "response" TEXT,
    "createdCategoryId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "blockedById" TEXT,
    "minPrice" INTEGER NOT NULL DEFAULT 0,
    "maxPrice" INTEGER NOT NULL DEFAULT 0,
    "totalStock" INTEGER NOT NULL DEFAULT 0,
    "searchVector" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "optionValues" TEXT[],
    "price" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attribute_values" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "textValues" TEXT[],
    "numberValue" DOUBLE PRECISION,
    "booleanValue" BOOLEAN,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_sortOrder_idx" ON "categories"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "category_slug_redirects_categoryId_idx" ON "category_slug_redirects"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "category_attributes_categoryId_key_key" ON "category_attributes"("categoryId", "key");

-- CreateIndex
CREATE INDEX "category_suggestions_status_createdAt_idx" ON "category_suggestions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "category_suggestions_storeId_idx" ON "category_suggestions"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_storeId_status_updatedAt_idx" ON "products"("storeId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "products_categoryId_status_publishedAt_idx" ON "products"("categoryId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "products_status_publishedAt_idx" ON "products"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "products_searchVector_idx" ON "products" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "products_title_idx" ON "products" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_sku_key" ON "product_variants"("productId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_optionValues_key" ON "product_variants"("productId", "optionValues");

-- CreateIndex
CREATE INDEX "product_images_productId_sortOrder_idx" ON "product_images"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_attribute_values_attributeId_numberValue_idx" ON "product_attribute_values"("attributeId", "numberValue");

-- CreateIndex
CREATE INDEX "product_attribute_values_textValues_idx" ON "product_attribute_values" USING GIN ("textValues");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_values_productId_attributeId_key" ON "product_attribute_values"("productId", "attributeId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_slug_redirects" ADD CONSTRAINT "category_slug_redirects_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_createdCategoryId_fkey" FOREIGN KEY ("createdCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "category_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma can't express.
-- ---------------------------------------------------------------------------

-- Category tree. `path` is "/<ancestor ids>/<own id>/". Depth is capped at 3
-- levels in the app; the check here is a looser safety net so the cap can be
-- raised without a migration.
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_depth_check" CHECK ("depth" BETWEEN 0 AND 5),
  ADD CONSTRAINT "categories_path_check" CHECK ("path" LIKE '/%/' AND "path" LIKE '%/' || "id" || '/'),
  ADD CONSTRAINT "categories_root_check" CHECK (("parentId" IS NULL) = ("depth" = 0)),
  ADD CONSTRAINT "categories_commission_check" CHECK ("commissionBps" IS NULL OR "commissionBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "categories_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE "category_attributes"
  ADD CONSTRAINT "category_attributes_key_check" CHECK ("key" ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  ADD CONSTRAINT "category_attributes_options_check" CHECK (("type" IN ('select', 'multiselect')) = (cardinality("options") > 0));

-- One pending suggestion per store for the same name.
CREATE UNIQUE INDEX "category_suggestions_one_pending_per_name"
  ON "category_suggestions" ("storeId", lower("name")) WHERE "status" = 'pending';

-- Money and stock can never go negative.
ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_price_check" CHECK ("price" > 0),
  ADD CONSTRAINT "product_variants_compare_at_check" CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" > "price"),
  ADD CONSTRAINT "product_variants_stock_check" CHECK ("stock" >= 0);
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_range_check" CHECK ("minPrice" >= 0 AND "maxPrice" >= "minPrice" AND "totalStock" >= 0),
  ADD CONSTRAINT "products_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "platform_settings"
  ADD CONSTRAINT "platform_settings_low_stock_check" CHECK ("lowStockThreshold" >= 0);

-- Full-text search vector, kept current by a trigger (title ranks above description).
CREATE FUNCTION "products_search_vector_update"() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', left(coalesce(NEW."description", ''), 10000)), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "products_search_vector_trigger"
  BEFORE INSERT OR UPDATE OF "title", "description" ON "products"
  FOR EACH ROW EXECUTE FUNCTION "products_search_vector_update"();

-- Launch categories. Admins edit, add to or hide these from /admin/categories.
INSERT INTO "categories" ("id", "parentId", "name", "slug", "path", "depth", "sortOrder", "imageUrl", "updatedAt") VALUES
  ('cat_electronics', NULL, 'Electronics',   'electronics', '/cat_electronics/', 0, 1, '/images/categories/electronics.jpg', now()),
  ('cat_fashion',     NULL, 'Fashion',       'fashion',     '/cat_fashion/',     0, 2, '/images/categories/fashion.jpg', now()),
  ('cat_beauty',      NULL, 'Beauty',        'beauty',      '/cat_beauty/',      0, 3, '/images/categories/beauty.jpg', now()),
  ('cat_home_living', NULL, 'Home & Living', 'home-living', '/cat_home_living/', 0, 4, '/images/categories/home-living.jpg', now()),
  ('cat_sports',      NULL, 'Sports',        'sports',      '/cat_sports/',      0, 5, '/images/categories/sports.jpg', now())
ON CONFLICT DO NOTHING;
