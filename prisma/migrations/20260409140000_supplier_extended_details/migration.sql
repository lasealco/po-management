-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "legalName" TEXT,
ADD COLUMN "taxId" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "registeredAddressLine1" TEXT,
ADD COLUMN "registeredAddressLine2" TEXT,
ADD COLUMN "registeredCity" TEXT,
ADD COLUMN "registeredRegion" TEXT,
ADD COLUMN "registeredPostalCode" TEXT,
ADD COLUMN "registeredCountryCode" VARCHAR(2),
ADD COLUMN "paymentTermsDays" INTEGER,
ADD COLUMN "paymentTermsLabel" TEXT,
ADD COLUMN "creditLimit" DECIMAL(14,2),
ADD COLUMN "creditCurrency" VARCHAR(3),
ADD COLUMN "defaultIncoterm" TEXT,
ADD COLUMN "internalNotes" TEXT;

-- CreateTable
CREATE TABLE "SupplierContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierContact_tenantId_idx" ON "SupplierContact"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierContact_supplierId_idx" ON "SupplierContact"("supplierId");

-- AddForeignKey
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
