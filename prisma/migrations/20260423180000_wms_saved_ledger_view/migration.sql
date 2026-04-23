-- Per-user WMS stock movement ledger saved filter views (WmsSavedLedgerView).

CREATE TABLE "WmsSavedLedgerView" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filtersJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsSavedLedgerView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WmsSavedLedgerView_tenantId_userId_idx" ON "WmsSavedLedgerView"("tenantId", "userId");
CREATE INDEX "WmsSavedLedgerView_userId_idx" ON "WmsSavedLedgerView"("userId");

ALTER TABLE "WmsSavedLedgerView" ADD CONSTRAINT "WmsSavedLedgerView_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsSavedLedgerView" ADD CONSTRAINT "WmsSavedLedgerView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
