-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('own_rider', 'courier');

-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('buyer', 'seller', 'admin', 'system');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('not_received', 'faulty', 'not_as_described', 'other');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "DisputeOutcome" AS ENUM ('full_refund', 'partial_refund', 'rejected');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('pending', 'sent', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubOrderStatus" ADD VALUE 'processing';
ALTER TYPE "SubOrderStatus" ADD VALUE 'shipped';
ALTER TYPE "SubOrderStatus" ADD VALUE 'delivered';
ALTER TYPE "SubOrderStatus" ADD VALUE 'completed';

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "shipWithinDays" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "sub_orders" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "carrierName" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedBy" "ActorKind",
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryMethod" "DeliveryMethod",
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "riderPhone" TEXT,
ADD COLUMN     "shipBy" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "trackingNumber" TEXT;

-- CreateTable
CREATE TABLE "sub_order_events" (
    "id" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "fromStatus" "SubOrderStatus",
    "toStatus" "SubOrderStatus" NOT NULL,
    "actorKind" "ActorKind" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "description" TEXT NOT NULL,
    "sellerResponse" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "outcome" "DisputeOutcome",
    "resolutionNote" TEXT,
    "refundId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_attachments" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sendAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sub_order_events_subOrderId_createdAt_idx" ON "sub_order_events"("subOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "disputes_status_createdAt_idx" ON "disputes"("status", "createdAt");

-- CreateIndex
CREATE INDEX "disputes_subOrderId_idx" ON "disputes"("subOrderId");

-- CreateIndex
CREATE INDEX "dispute_attachments_disputeId_idx" ON "dispute_attachments"("disputeId");

-- CreateIndex
CREATE INDEX "email_outbox_status_sendAfter_idx" ON "email_outbox"("status", "sendAfter");

-- AddForeignKey
ALTER TABLE "sub_order_events" ADD CONSTRAINT "sub_order_events_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_attachments" ADD CONSTRAINT "dispute_attachments_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma can't express.
-- ---------------------------------------------------------------------------

ALTER TABLE "platform_settings"
  ADD CONSTRAINT "platform_settings_ship_within_check" CHECK ("shipWithinDays" BETWEEN 1 AND 30);

-- Shipping details come together: a method, a name, and a way to follow it up.
ALTER TABLE "sub_orders"
  ADD CONSTRAINT "sub_orders_shipping_check" CHECK (
    "shippedAt" IS NULL
    OR ("deliveryMethod" IS NOT NULL AND "carrierName" IS NOT NULL AND ("riderPhone" IS NOT NULL OR "trackingNumber" IS NOT NULL))
  );

-- At most one open dispute per seller's part of an order.
CREATE UNIQUE INDEX "disputes_one_open_per_sub_order" ON "disputes" ("subOrderId") WHERE "status" = 'open';

-- A resolved dispute has an outcome; an open one doesn't.
ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_outcome_check" CHECK (("status" = 'resolved') = ("outcome" IS NOT NULL));

ALTER TABLE "email_outbox"
  ADD CONSTRAINT "email_outbox_attempts_check" CHECK ("attempts" >= 0);
