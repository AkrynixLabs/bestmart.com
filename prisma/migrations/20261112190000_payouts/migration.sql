-- CreateEnum
CREATE TYPE "PayoutBatchStatus" AS ENUM ('draft', 'sending', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'processing', 'paid', 'failed', 'cancelled');

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "payoutId" TEXT;

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "payoutMinimum" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "payoutWeekday" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "payoutBankCode" TEXT,
ADD COLUMN     "payoutRecipientCode" TEXT,
ADD COLUMN     "payoutRecipientKey" TEXT;

-- CreateTable
CREATE TABLE "payout_batches" (
    "id" TEXT NOT NULL,
    "status" "PayoutBatchStatus" NOT NULL DEFAULT 'draft',
    "total" INTEGER NOT NULL DEFAULT 0,
    "preparedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "reference" TEXT NOT NULL,
    "transferCode" TEXT,
    "issue" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payout_batches_status_createdAt_idx" ON "payout_batches"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_reference_key" ON "payouts"("reference");

-- CreateIndex
CREATE INDEX "payouts_storeId_createdAt_idx" ON "payouts"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_batchId_storeId_key" ON "payouts"("batchId", "storeId");

-- AddForeignKey
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payout_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma can't express.
-- ---------------------------------------------------------------------------

ALTER TABLE "platform_settings"
  ADD CONSTRAINT "platform_settings_payout_check" CHECK ("payoutMinimum" >= 100 AND "payoutWeekday" BETWEEN 0 AND 6);

ALTER TABLE "payouts"
  ADD CONSTRAINT "payouts_amount_check" CHECK ("amount" > 0);

ALTER TABLE "payout_batches"
  ADD CONSTRAINT "payout_batches_total_check" CHECK ("total" >= 0);

-- Only one batch can be open (draft or sending) at a time.
CREATE UNIQUE INDEX "payout_batches_one_open" ON "payout_batches" ((true)) WHERE "status" IN ('draft', 'sending');

-- A payout is debited from the ledger once.
CREATE UNIQUE INDEX "ledger_entries_one_debit_per_payout" ON "ledger_entries" ("payoutId") WHERE "kind" = 'payout';
