-- Control Tower: tenant milestone template packs (optional DB overrides of built-in packs).

CREATE TABLE "CtMilestoneTemplatePack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "milestones" JSONB NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CtMilestoneTemplatePack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CtMilestoneTemplatePack_tenantId_slug_key" ON "CtMilestoneTemplatePack"("tenantId", "slug");
CREATE INDEX "CtMilestoneTemplatePack_tenantId_idx" ON "CtMilestoneTemplatePack"("tenantId");

ALTER TABLE "CtMilestoneTemplatePack" ADD CONSTRAINT "CtMilestoneTemplatePack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
