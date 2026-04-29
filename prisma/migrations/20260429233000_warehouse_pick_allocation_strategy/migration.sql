-- CreateEnum
CREATE TYPE "WmsPickAllocationStrategy" AS ENUM ('MAX_AVAILABLE_FIRST', 'FIFO_BY_BIN_CODE', 'MANUAL_ONLY');

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN "pickAllocationStrategy" "WmsPickAllocationStrategy" NOT NULL DEFAULT 'MAX_AVAILABLE_FIRST';
