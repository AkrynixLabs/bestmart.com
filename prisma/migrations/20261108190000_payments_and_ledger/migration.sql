-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('initialized', 'succeeded', 'failed', 'abandoned');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('sale', 'commission', 'delivery', 'refund', 'commission_reversal', 'delivery_refund', 'payout', 'adjustment');

-- CreateEnum
CREATE TYPE "LedgerBucket" AS ENUM ('pending', 'available');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'refunded';

-- AlterEnum
ALTER TYPE "SubOrderStatus" ADD VALUE 'refunded';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "refundedTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sub_orders" ADD COLUMN     "commissionTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "refundedTotal" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "status" "PaymentStatus" NOT NULL DEFAULT 'initialized',
    "providerTransactionId" TEXT,
    "channel" TEXT,
    "providerFee" INTEGER,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "itemsAmount" INTEGER NOT NULL,
    "deliveryAmount" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "providerRefundId" TEXT,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "subOrderId" TEXT,
    "refundId" TEXT,
    "kind" "LedgerKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "bucket" "LedgerBucket" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "webhook_events_receivedAt_idx" ON "webhook_events"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_dedupeKey_key" ON "webhook_events"("provider", "dedupeKey");

-- CreateIndex
CREATE INDEX "refunds_orderId_idx" ON "refunds"("orderId");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "ledger_entries_storeId_bucket_idx" ON "ledger_entries"("storeId", "bucket");

-- CreateIndex
CREATE INDEX "ledger_entries_subOrderId_idx" ON "ledger_entries"("subOrderId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma can't express.
-- ---------------------------------------------------------------------------

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0 AND ("providerFee" IS NULL OR "providerFee" >= 0));

-- A refund's parts add up, and are never negative.
ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amounts_check" CHECK (
    "amount" > 0 AND "itemsAmount" >= 0 AND "deliveryAmount" >= 0 AND "commissionAmount" >= 0
    AND "amount" = "itemsAmount" + "deliveryAmount"
  );

-- Refunds can't exceed what was paid.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_refunded_check" CHECK ("refundedTotal" BETWEEN 0 AND "grandTotal");
ALTER TABLE "sub_orders"
  ADD CONSTRAINT "sub_orders_refunded_check" CHECK ("refundedTotal" BETWEEN 0 AND "itemsTotal" + "deliveryFee"),
  ADD CONSTRAINT "sub_orders_commission_check" CHECK ("commissionTotal" BETWEEN 0 AND "itemsTotal");

-- Ledger entries carry the sign their kind implies (adjustments may be either).
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_sign_check" CHECK (
    ("kind" IN ('sale', 'delivery', 'commission_reversal') AND "amount" >= 0)
    OR ("kind" IN ('commission', 'refund', 'delivery_refund', 'payout') AND "amount" <= 0)
    OR "kind" = 'adjustment'
  );

-- At most one successful payment per order: a second success must be refunded, not double-counted.
CREATE UNIQUE INDEX "payments_one_success_per_order" ON "payments" ("orderId") WHERE "status" = 'succeeded';
