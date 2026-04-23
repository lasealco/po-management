-- Phase H: link supplier-portal users to a Supplier row for self-service scope.
ALTER TABLE "User" ADD COLUMN "portalLinkedSupplierId" TEXT;

CREATE INDEX "User_portalLinkedSupplierId_idx" ON "User"("portalLinkedSupplierId");

ALTER TABLE "User" ADD CONSTRAINT "User_portalLinkedSupplierId_fkey" FOREIGN KEY ("portalLinkedSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
