-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('OCEAN', 'AIR', 'ROAD', 'RAIL');

-- CreateEnum
CREATE TYPE "ContainerSize" AS ENUM ('LCL', 'FCL_20', 'FCL_40', 'FCL_40HC', 'TRUCK_13_6', 'AIR_ULD');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "Shipment"
ADD COLUMN "transportMode" "TransportMode",
ADD COLUMN "estimatedVolumeCbm" DECIMAL(12,3),
ADD COLUMN "estimatedWeightKg" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "LoadPlan"
ADD COLUMN "transportMode" "TransportMode" NOT NULL DEFAULT 'OCEAN',
ADD COLUMN "containerSize" "ContainerSize" NOT NULL DEFAULT 'LCL';

-- CreateIndex
CREATE INDEX "Shipment_transportMode_idx" ON "Shipment"("transportMode");
