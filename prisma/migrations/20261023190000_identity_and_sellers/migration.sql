-- CreateEnum
CREATE TYPE "Role" AS ENUM ('customer', 'seller', 'ops_admin', 'super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('verify_email', 'reset_password');

-- CreateEnum
CREATE TYPE "GhanaRegion" AS ENUM ('greater_accra', 'ashanti', 'western', 'western_north', 'central', 'eastern', 'volta', 'oti', 'northern', 'savannah', 'north_east', 'upper_east', 'upper_west', 'bono', 'bono_east', 'ahafo');

-- CreateEnum
CREATE TYPE "SellerApplicationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('individual', 'registered_business');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('mobile_money', 'bank_account');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('active', 'suspended');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "role" "Role" NOT NULL DEFAULT 'customer',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "region" "GhanaRegion" NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "streetAddress" TEXT,
    "landmark" TEXT,
    "gpsAddress" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL,
    "businessRegistrationNumber" TEXT,
    "ghanaCardNumber" TEXT NOT NULL,
    "ghanaCardImageKey" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "region" "GhanaRegion" NOT NULL,
    "city" TEXT NOT NULL,
    "categoriesNote" TEXT,
    "payoutMethod" "PayoutMethod" NOT NULL,
    "payoutProvider" TEXT NOT NULL,
    "payoutAccountName" TEXT NOT NULL,
    "payoutAccountNumber" TEXT NOT NULL,
    "status" "SellerApplicationStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "phone" TEXT NOT NULL,
    "region" "GhanaRegion" NOT NULL,
    "city" TEXT NOT NULL,
    "status" "StoreStatus" NOT NULL DEFAULT 'active',
    "payoutMethod" "PayoutMethod" NOT NULL,
    "payoutProvider" TEXT NOT NULL,
    "payoutAccountName" TEXT NOT NULL,
    "payoutAccountNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_purpose_idx" ON "auth_tokens"("userId", "purpose");

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE INDEX "seller_applications_status_createdAt_idx" ON "seller_applications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "seller_applications_userId_idx" ON "seller_applications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_userId_key" ON "stores"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_applicationId_key" ON "stores"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "seller_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written: constraints Prisma can't express.
-- Emails are stored normalised (trimmed, lower-case).
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalised" CHECK ("email" = lower(btrim("email")));
-- At most one pending seller application per user.
CREATE UNIQUE INDEX "seller_applications_one_pending_per_user" ON "seller_applications" ("userId") WHERE "status" = 'pending';
-- At most one default address per user.
CREATE UNIQUE INDEX "addresses_one_default_per_user" ON "addresses" ("userId") WHERE "isDefault";
