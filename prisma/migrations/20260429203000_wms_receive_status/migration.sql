-- CreateEnum
CREATE TYPE "WmsReceiveStatus" AS ENUM ('NOT_TRACKED', 'EXPECTED', 'AT_DOCK', 'RECEIVING', 'RECEIPT_COMPLETE', 'DISCREPANCY', 'CLOSED');

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "wmsReceiveStatus" "WmsReceiveStatus" NOT NULL DEFAULT 'NOT_TRACKED';
ALTER TABLE "Shipment" ADD COLUMN "wmsReceiveNote" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "wmsReceiveUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN "wmsReceiveUpdatedById" TEXT;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_wmsReceiveUpdatedById_fkey" FOREIGN KEY ("wmsReceiveUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
