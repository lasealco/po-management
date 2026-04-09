-- CreateEnum
CREATE TYPE "ProductDocumentKind" AS ENUM ('PRIMARY_IMAGE', 'MSDS', 'OTHER');

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDivision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOffice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSupplier" (
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSupplier_pkey" PRIMARY KEY ("productId","supplierId")
);

-- CreateTable
CREATE TABLE "ProductDocument" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "ProductDocumentKind" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDocument_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "productCode" TEXT,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "divisionId" TEXT,
ADD COLUMN     "ean" VARCHAR(32),
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "primaryImageUrl" TEXT,
ADD COLUMN     "hsCode" TEXT,
ADD COLUMN     "isDangerousGoods" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dangerousGoodsClass" TEXT,
ADD COLUMN     "unNumber" TEXT,
ADD COLUMN     "properShippingName" TEXT,
ADD COLUMN     "packingGroup" TEXT,
ADD COLUMN     "flashPoint" DECIMAL(10,2),
ADD COLUMN     "flashPointUnit" TEXT,
ADD COLUMN     "msdsUrl" TEXT,
ADD COLUMN     "isTemperatureControlled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "temperatureRangeText" TEXT,
ADD COLUMN     "temperatureUnit" TEXT,
ADD COLUMN     "coolingType" TEXT,
ADD COLUMN     "packagingNotes" TEXT,
ADD COLUMN     "humidityRequirements" TEXT,
ADD COLUMN     "storageDescription" TEXT,
ADD COLUMN     "isForReexport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierOfficeId" TEXT;

-- Align description length with Prisma @db.VarChar(2000)
ALTER TABLE "Product" ALTER COLUMN "description" TYPE VARCHAR(2000);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_tenantId_name_key" ON "ProductCategory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ProductCategory_tenantId_idx" ON "ProductCategory"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDivision_tenantId_name_key" ON "ProductDivision"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ProductDivision_tenantId_idx" ON "ProductDivision"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOffice_supplierId_name_key" ON "SupplierOffice"("supplierId", "name");

-- CreateIndex
CREATE INDEX "SupplierOffice_tenantId_idx" ON "SupplierOffice"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierOffice_supplierId_idx" ON "SupplierOffice"("supplierId");

-- CreateIndex
CREATE INDEX "ProductSupplier_supplierId_idx" ON "ProductSupplier"("supplierId");

-- CreateIndex
CREATE INDEX "ProductDocument_productId_idx" ON "ProductDocument"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_productCode_key" ON "Product"("tenantId", "productCode");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_divisionId_idx" ON "Product"("divisionId");

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDivision" ADD CONSTRAINT "ProductDivision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOffice" ADD CONSTRAINT "SupplierOffice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOffice" ADD CONSTRAINT "SupplierOffice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "ProductDivision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierOfficeId_fkey" FOREIGN KEY ("supplierOfficeId") REFERENCES "SupplierOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
