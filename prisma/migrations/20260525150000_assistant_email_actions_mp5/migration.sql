-- MP5/MP7: link copy/paste email threads to the draft sales orders they create.
ALTER TABLE "AssistantEmailThread"
ADD COLUMN "salesOrderId" TEXT;

CREATE INDEX "AssistantEmailThread_tenantId_salesOrderId_idx"
ON "AssistantEmailThread"("tenantId", "salesOrderId");

ALTER TABLE "AssistantEmailThread"
ADD CONSTRAINT "AssistantEmailThread_salesOrderId_fkey"
FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
