-- SRM: supplier relationship / account notes (chronological log).

CREATE TABLE "SupplierRelationshipNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierRelationshipNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierRelationshipNote_tenantId_supplierId_idx" ON "SupplierRelationshipNote"("tenantId", "supplierId");

ALTER TABLE "SupplierRelationshipNote" ADD CONSTRAINT "SupplierRelationshipNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierRelationshipNote" ADD CONSTRAINT "SupplierRelationshipNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
