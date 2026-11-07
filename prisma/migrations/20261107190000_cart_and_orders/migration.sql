-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('awaiting_payment', 'paid', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "SubOrderStatus" AS ENUM ('awaiting_payment', 'paid', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "DistanceSource" AS ENUM ('pins', 'area', 'town', 'region');

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "deliveryBands" JSONB NOT NULL DEFAULT '[{"upToKm":5,"feePesewas":1500},{"upToKm":10,"feePesewas":2000},{"upToKm":20,"feePesewas":3000},{"upToKm":40,"feePesewas":4500},{"upToKm":100,"feePesewas":7000},{"upToKm":300,"feePesewas":10000},{"upToKm":null,"feePesewas":14000}]',
ADD COLUMN     "deliveryRoadFactorPct" INTEGER NOT NULL DEFAULT 130;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "pickupArea" TEXT,
ADD COLUMN     "pickupLatitude" DOUBLE PRECISION,
ADD COLUMN     "pickupLongitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'awaiting_payment',
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "itemsTotal" INTEGER NOT NULL,
    "deliveryTotal" INTEGER NOT NULL,
    "grandTotal" INTEGER NOT NULL,
    "reservedUntil" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "region" "GhanaRegion" NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "streetAddress" TEXT,
    "landmark" TEXT,
    "gpsAddress" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_orders" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "SubOrderStatus" NOT NULL DEFAULT 'awaiting_payment',
    "itemsTotal" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL,
    "deliveryKm" DOUBLE PRECISION NOT NULL,
    "distanceSource" "DistanceSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "title" TEXT NOT NULL,
    "optionValues" TEXT[],
    "sku" TEXT NOT NULL,
    "imageUrl" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "carts_guestToken_key" ON "carts"("guestToken");

-- CreateIndex
CREATE INDEX "carts_updatedAt_idx" ON "carts"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_variantId_key" ON "cart_items"("cartId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_reservedUntil_idx" ON "orders"("status", "reservedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "orders_userId_idempotencyKey_key" ON "orders"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "sub_orders_storeId_status_createdAt_idx" ON "sub_orders"("storeId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sub_orders_orderId_storeId_key" ON "sub_orders"("orderId", "storeId");

-- CreateIndex
CREATE INDEX "order_items_subOrderId_idx" ON "order_items"("subOrderId");

-- CreateIndex
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma can't express.
-- ---------------------------------------------------------------------------

-- Map pins are valid coordinates, and come as a pair.
ALTER TABLE "addresses"
  ADD CONSTRAINT "addresses_pin_check" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
  );
ALTER TABLE "stores"
  ADD CONSTRAINT "stores_pickup_pin_check" CHECK (
    ("pickupLatitude" IS NULL AND "pickupLongitude" IS NULL)
    OR ("pickupLatitude" BETWEEN -90 AND 90 AND "pickupLongitude" BETWEEN -180 AND 180)
  );
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_pin_check" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
  );

ALTER TABLE "platform_settings"
  ADD CONSTRAINT "platform_settings_road_factor_check" CHECK ("deliveryRoadFactorPct" BETWEEN 100 AND 300);

-- A cart belongs to exactly one of: a user, or a guest cookie.
ALTER TABLE "carts"
  ADD CONSTRAINT "carts_owner_check" CHECK (("userId" IS NULL) <> ("guestToken" IS NULL));
ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99);

-- Money adds up and never goes negative.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_totals_check" CHECK (
    "itemsTotal" > 0 AND "deliveryTotal" >= 0 AND "grandTotal" = "itemsTotal" + "deliveryTotal"
  );
ALTER TABLE "sub_orders"
  ADD CONSTRAINT "sub_orders_totals_check" CHECK ("itemsTotal" > 0 AND "deliveryFee" >= 0 AND "deliveryKm" >= 0);
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_amounts_check" CHECK (
    "quantity" > 0 AND "unitPrice" > 0 AND "lineTotal" = "unitPrice" * "quantity"
    AND "commissionBps" BETWEEN 0 AND 10000
  );
