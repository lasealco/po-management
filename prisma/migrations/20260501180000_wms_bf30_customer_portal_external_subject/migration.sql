-- BF-30: map IdP `sub` (or equivalent) to User for customer-portal SSO bridge

ALTER TABLE "User" ADD COLUMN "customerPortalExternalSubject" VARCHAR(255);

CREATE UNIQUE INDEX "User_tenantId_customerPortalExternalSubject_key"
  ON "User" ("tenantId", "customerPortalExternalSubject");
