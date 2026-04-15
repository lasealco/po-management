-- CreateEnum
CREATE TYPE "ReportDataset" AS ENUM ('CONTROL_TOWER', 'PO', 'CRM', 'WMS');

-- AlterTable
ALTER TABLE "CtSavedReport" ADD COLUMN "dataset" "ReportDataset" NOT NULL DEFAULT 'CONTROL_TOWER';

-- CreateIndex
CREATE INDEX "CtSavedReport_tenantId_dataset_createdAt_idx" ON "CtSavedReport"("tenantId", "dataset", "createdAt");
