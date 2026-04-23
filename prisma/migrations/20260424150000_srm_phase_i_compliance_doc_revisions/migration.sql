-- Phase I: compliance document revision family (DMS-style chain), vault v1 extension.

ALTER TABLE "SrmSupplierDocument" ADD COLUMN "revisionGroupId" TEXT;
ALTER TABLE "SrmSupplierDocument" ADD COLUMN "revisionNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SrmSupplierDocument" ADD COLUMN "supersedesDocumentId" TEXT;

UPDATE "SrmSupplierDocument" SET "revisionGroupId" = "id" WHERE "revisionGroupId" IS NULL;

ALTER TABLE "SrmSupplierDocument" ALTER COLUMN "revisionGroupId" SET NOT NULL;

CREATE UNIQUE INDEX "SrmSupplierDocument_revisionGroupId_revisionNumber_key" ON "SrmSupplierDocument"("revisionGroupId", "revisionNumber");

CREATE INDEX "SrmSupplierDocument_tenantId_revisionGroupId_idx" ON "SrmSupplierDocument"("tenantId", "revisionGroupId");

ALTER TABLE "SrmSupplierDocument" ADD CONSTRAINT "SrmSupplierDocument_supersedesDocumentId_fkey" FOREIGN KEY ("supersedesDocumentId") REFERENCES "SrmSupplierDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
