-- Phase 1: org operating / process tags (not app RBAC)

CREATE TYPE "OrgUnitOperatingRole" AS ENUM (
  'REGIONAL_HQ',
  'GROUP_PROCUREMENT',
  'PLANT',
  'DIST_CENTER',
  'SALES_HUB',
  'SHARED_SERVICE',
  'R_AND_D',
  'CORPORATE_FUNCTION',
  'LOGISTICS_HUB'
);

CREATE TABLE "org_unit_role_assignments" (
    "id" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "role" "OrgUnitOperatingRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_unit_role_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_unit_role_assignments_orgUnitId_role_key" ON "org_unit_role_assignments"("orgUnitId", "role");

CREATE INDEX "org_unit_role_assignments_orgUnitId_idx" ON "org_unit_role_assignments"("orgUnitId");

ALTER TABLE "org_unit_role_assignments" ADD CONSTRAINT "org_unit_role_assignments_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
