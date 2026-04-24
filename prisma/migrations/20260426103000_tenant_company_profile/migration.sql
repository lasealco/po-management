-- Optional company profile fields for settings / PDFs / integrations.
ALTER TABLE "Tenant" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "phone" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "website" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "addressCity" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "addressRegion" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "addressPostalCode" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "addressCountryCode" VARCHAR(2);
ALTER TABLE "Tenant" ADD COLUMN "linkedinUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "twitterUrl" TEXT;
