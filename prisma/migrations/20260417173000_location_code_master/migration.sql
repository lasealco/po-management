-- CreateEnum
CREATE TYPE "LocationCodeType" AS ENUM ('UN_LOCODE', 'PORT', 'AIRPORT');

-- CreateTable
CREATE TABLE "LocationCode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "LocationCodeType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" VARCHAR(2),
    "subdivision" TEXT,
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationCode_tenantId_type_code_key" ON "LocationCode"("tenantId", "type", "code");

-- CreateIndex
CREATE INDEX "LocationCode_tenantId_type_isActive_idx" ON "LocationCode"("tenantId", "type", "isActive");

-- CreateIndex
CREATE INDEX "LocationCode_tenantId_code_idx" ON "LocationCode"("tenantId", "code");

-- AddForeignKey
ALTER TABLE "LocationCode" ADD CONSTRAINT "LocationCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
