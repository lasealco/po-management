-- SRM Phase C (slices 16–20): supplier compliance document vault + append-only audit log.
-- Rollback: DROP TABLE "SrmSupplierDocumentAuditLog"; DROP TABLE "SrmSupplierDocument";
--           DROP TYPE "SrmSupplierDocumentStatus"; DROP TYPE "SrmSupplierDocumentType";

CREATE TYPE "SrmSupplierDocumentType" AS ENUM (
  'certificate_of_insurance',
  'w9',
  'code_of_conduct',
  'quality_agreement',
  'tax_certificate',
  'other'
);

CREATE TYPE "SrmSupplierDocumentStatus" AS ENUM ('active', 'archived', 'superseded');

CREATE TABLE "SrmSupplierDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "documentType" "SrmSupplierDocumentType" NOT NULL,
    "status" "SrmSupplierDocumentStatus" NOT NULL DEFAULT 'active',
    "title" VARCHAR(256),
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" VARCHAR(512),
    "fileUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "lastModifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SrmSupplierDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SrmSupplierDocumentAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "details" JSONB,

    CONSTRAINT "SrmSupplierDocumentAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SrmSupplierDocument_tenantId_supplierId_idx" ON "SrmSupplierDocument"("tenantId", "supplierId");
CREATE INDEX "SrmSupplierDocument_tenantId_status_idx" ON "SrmSupplierDocument"("tenantId", "status");
CREATE INDEX "SrmSupplierDocument_tenantId_expiresAt_idx" ON "SrmSupplierDocument"("tenantId", "expiresAt");

CREATE INDEX "SrmSupplierDocumentAuditLog_documentId_at_idx" ON "SrmSupplierDocumentAuditLog"("documentId", "at");
CREATE INDEX "SrmSupplierDocumentAuditLog_tenantId_at_idx" ON "SrmSupplierDocumentAuditLog"("tenantId", "at");

ALTER TABLE "SrmSupplierDocument" ADD CONSTRAINT "SrmSupplierDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SrmSupplierDocument" ADD CONSTRAINT "SrmSupplierDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SrmSupplierDocument" ADD CONSTRAINT "SrmSupplierDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SrmSupplierDocument" ADD CONSTRAINT "SrmSupplierDocument_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SrmSupplierDocumentAuditLog" ADD CONSTRAINT "SrmSupplierDocumentAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SrmSupplierDocumentAuditLog" ADD CONSTRAINT "SrmSupplierDocumentAuditLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SrmSupplierDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SrmSupplierDocumentAuditLog" ADD CONSTRAINT "SrmSupplierDocumentAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
