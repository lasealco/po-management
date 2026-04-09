-- CreateEnum
CREATE TYPE "SplitProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "splitIndex" INTEGER,
ADD COLUMN     "splitProposalId" TEXT;

-- CreateTable
CREATE TABLE "SplitProposal" (
    "id" TEXT NOT NULL,
    "parentOrderId" TEXT NOT NULL,
    "status" "SplitProposalStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "proposedByUserId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SplitProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitProposalLine" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "sourceLineId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "plannedShipDate" TIMESTAMP(3) NOT NULL,
    "childIndex" INTEGER NOT NULL,

    CONSTRAINT "SplitProposalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SplitProposal_parentOrderId_idx" ON "SplitProposal"("parentOrderId");

-- CreateIndex
CREATE INDEX "SplitProposal_status_idx" ON "SplitProposal"("status");

-- CreateIndex
CREATE INDEX "SplitProposalLine_proposalId_idx" ON "SplitProposalLine"("proposalId");

-- CreateIndex
CREATE INDEX "SplitProposalLine_sourceLineId_idx" ON "SplitProposalLine"("sourceLineId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_splitParentId_idx" ON "PurchaseOrder"("splitParentId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_splitProposalId_idx" ON "PurchaseOrder"("splitProposalId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_splitProposalId_fkey" FOREIGN KEY ("splitProposalId") REFERENCES "SplitProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitProposal" ADD CONSTRAINT "SplitProposal_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitProposal" ADD CONSTRAINT "SplitProposal_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitProposalLine" ADD CONSTRAINT "SplitProposalLine_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "SplitProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitProposalLine" ADD CONSTRAINT "SplitProposalLine_sourceLineId_fkey" FOREIGN KEY ("sourceLineId") REFERENCES "PurchaseOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
