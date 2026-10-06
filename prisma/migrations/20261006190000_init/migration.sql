-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "commissionBps" INTEGER NOT NULL DEFAULT 1000,
    "stockReservationMinutes" INTEGER NOT NULL DEFAULT 30,
    "autoConfirmDeliveryDays" INTEGER NOT NULL DEFAULT 7,
    "payoutHoldDays" INTEGER NOT NULL DEFAULT 3,
    "returnWindowDays" INTEGER NOT NULL DEFAULT 7,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
