-- CreateEnum
CREATE TYPE "TariffProviderType" AS ENUM ('OCEAN_CARRIER', 'NVOCC', 'FORWARDER', 'AIRLINE', 'TRUCKER', 'RAIL_OPERATOR', 'WAREHOUSE', 'BROKER', 'COURIER', 'OTHER');

-- CreateEnum
CREATE TYPE "TariffTransportMode" AS ENUM ('OCEAN', 'LCL', 'AIR', 'TRUCK', 'RAIL', 'LOCAL_SERVICE');

-- CreateEnum
CREATE TYPE "TariffContractStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'EXPIRED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TariffSourceType" AS ENUM ('MANUAL', 'EXCEL', 'PDF', 'API', 'EDI', 'EMAIL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TariffApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TariffGeographyType" AS ENUM ('GLOBAL_REGION', 'SUBREGION', 'COUNTRY', 'PORT', 'INLAND_POINT', 'RAIL_RAMP', 'ZONE', 'ALIAS_GROUP');

-- CreateEnum
CREATE TYPE "TariffLineRateType" AS ENUM ('BASE_RATE', 'ALL_IN', 'GATE_IN', 'GATE_IN_ALL_IN', 'GATE_IN_GATE_OUT', 'ADD_ON', 'LOCAL_CHARGE', 'SURCHARGE', 'CUSTOMS', 'PRE_CARRIAGE', 'ON_CARRIAGE');

-- CreateEnum
CREATE TYPE "TariffChargeFamily" AS ENUM ('MAIN_CARRIAGE', 'FUEL_ENVIRONMENTAL', 'SEASONAL_EMERGENCY', 'ORIGIN_TERMINAL', 'DEST_TERMINAL', 'ORIGIN_INLAND', 'DEST_INLAND', 'CUSTOMS_REGULATORY', 'HANDLING_SPECIAL', 'FREE_TIME_DELAY', 'ADMIN_OTHER');

-- CreateEnum
CREATE TYPE "TariffRuleType" AS ENUM ('DEMURRAGE', 'DETENTION', 'COMBINED_DD', 'STORAGE', 'PLUGIN', 'OTHER');

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "countryCode" VARCHAR(2),
    "baseCurrency" VARCHAR(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "providerType" "TariffProviderType" NOT NULL,
    "countryCode" VARCHAR(2),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geography_groups" (
    "id" TEXT NOT NULL,
    "geographyType" "TariffGeographyType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "aliasSource" TEXT,
    "validFrom" DATE,
    "validTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geography_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geography_members" (
    "id" TEXT NOT NULL,
    "geographyGroupId" TEXT NOT NULL,
    "memberCode" TEXT NOT NULL,
    "memberName" TEXT,
    "memberType" "TariffGeographyType" NOT NULL,
    "validFrom" DATE,
    "validTo" DATE,

    CONSTRAINT "geography_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "normalized_charge_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "chargeFamily" "TariffChargeFamily" NOT NULL,
    "transportMode" "TariffTransportMode",
    "isLocalCharge" BOOLEAN NOT NULL DEFAULT false,
    "isSurcharge" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "normalized_charge_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_aliases" (
    "id" TEXT NOT NULL,
    "normalizedChargeCodeId" TEXT NOT NULL,
    "aliasText" TEXT NOT NULL,
    "providerId" TEXT,
    "notes" TEXT,

    CONSTRAINT "charge_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_headers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalEntityId" TEXT,
    "providerId" TEXT NOT NULL,
    "transportMode" "TariffTransportMode" NOT NULL,
    "contractNumber" TEXT,
    "title" TEXT NOT NULL,
    "tradeScope" TEXT,
    "status" "TariffContractStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_versions" (
    "id" TEXT NOT NULL,
    "contractHeaderId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "sourceType" "TariffSourceType" NOT NULL,
    "sourceReference" TEXT,
    "sourceFileUrl" TEXT,
    "approvalStatus" "TariffApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "status" "TariffContractStatus" NOT NULL DEFAULT 'DRAFT',
    "validFrom" DATE,
    "validTo" DATE,
    "bookingDateValidFrom" DATE,
    "bookingDateValidTo" DATE,
    "sailingDateValidFrom" DATE,
    "sailingDateValidTo" DATE,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_lines" (
    "id" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "originScopeId" TEXT,
    "destinationScopeId" TEXT,
    "rateType" "TariffLineRateType" NOT NULL,
    "equipmentType" TEXT,
    "commodityScope" TEXT,
    "serviceScope" TEXT,
    "unitBasis" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "includedChargeSet" JSONB,
    "excludedChargeSet" JSONB,
    "rawRateDescription" TEXT,
    "validFrom" DATE,
    "validTo" DATE,
    "notes" TEXT,

    CONSTRAINT "rate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_lines" (
    "id" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "normalizedChargeCodeId" TEXT,
    "rawChargeName" TEXT NOT NULL,
    "geographyScopeId" TEXT,
    "directionScope" TEXT,
    "equipmentScope" TEXT,
    "conditionScope" TEXT,
    "unitBasis" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "isIncluded" BOOLEAN NOT NULL DEFAULT false,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" DATE,
    "validTo" DATE,
    "notes" TEXT,

    CONSTRAINT "charge_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "free_time_rules" (
    "id" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "geographyScopeId" TEXT,
    "importExportScope" TEXT,
    "equipmentScope" TEXT,
    "ruleType" "TariffRuleType" NOT NULL,
    "freeDays" INTEGER NOT NULL,
    "validFrom" DATE,
    "validTo" DATE,
    "notes" TEXT,

    CONSTRAINT "free_time_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "legalEntityId" TEXT,
    "sourceType" "TariffSourceType" NOT NULL,
    "uploadedFilename" TEXT,
    "sourceReference" TEXT,
    "parseStatus" TEXT NOT NULL DEFAULT 'UPLOADED',
    "confidenceScore" DECIMAL(5,2),
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_staging_rows" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "rowType" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "normalizedPayload" JSONB,
    "confidenceScore" DECIMAL(5,2),
    "unresolvedFlags" JSONB,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_staging_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_records" (
    "id" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "stepName" TEXT,
    "approverUserId" TEXT,
    "decision" "TariffApprovalStatus" NOT NULL,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_entities_tenantId_idx" ON "legal_entities"("tenantId");

-- CreateIndex
CREATE INDEX "geography_members_geographyGroupId_idx" ON "geography_members"("geographyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "normalized_charge_codes_code_key" ON "normalized_charge_codes"("code");

-- CreateIndex
CREATE INDEX "charge_aliases_normalizedChargeCodeId_idx" ON "charge_aliases"("normalizedChargeCodeId");

-- CreateIndex
CREATE INDEX "charge_aliases_providerId_idx" ON "charge_aliases"("providerId");

-- CreateIndex
CREATE INDEX "contract_headers_tenantId_idx" ON "contract_headers"("tenantId");

-- CreateIndex
CREATE INDEX "contract_headers_providerId_idx" ON "contract_headers"("providerId");

-- CreateIndex
CREATE INDEX "contract_versions_contractHeaderId_idx" ON "contract_versions"("contractHeaderId");

-- CreateIndex
CREATE INDEX "contract_versions_validFrom_validTo_idx" ON "contract_versions"("validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "contract_versions_contractHeaderId_versionNo_key" ON "contract_versions"("contractHeaderId", "versionNo");

-- CreateIndex
CREATE INDEX "rate_lines_contractVersionId_idx" ON "rate_lines"("contractVersionId");

-- CreateIndex
CREATE INDEX "charge_lines_contractVersionId_idx" ON "charge_lines"("contractVersionId");

-- CreateIndex
CREATE INDEX "free_time_rules_contractVersionId_idx" ON "free_time_rules"("contractVersionId");

-- CreateIndex
CREATE INDEX "import_batches_tenantId_idx" ON "import_batches"("tenantId");

-- CreateIndex
CREATE INDEX "import_staging_rows_importBatchId_idx" ON "import_staging_rows"("importBatchId");

-- CreateIndex
CREATE INDEX "approval_records_objectType_objectId_idx" ON "approval_records"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "audit_logs_objectType_objectId_idx" ON "audit_logs"("objectType", "objectId");

-- AddForeignKey
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geography_members" ADD CONSTRAINT "geography_members_geographyGroupId_fkey" FOREIGN KEY ("geographyGroupId") REFERENCES "geography_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_aliases" ADD CONSTRAINT "charge_aliases_normalizedChargeCodeId_fkey" FOREIGN KEY ("normalizedChargeCodeId") REFERENCES "normalized_charge_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_aliases" ADD CONSTRAINT "charge_aliases_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_headers" ADD CONSTRAINT "contract_headers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_headers" ADD CONSTRAINT "contract_headers_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_headers" ADD CONSTRAINT "contract_headers_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_headers" ADD CONSTRAINT "contract_headers_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contractHeaderId_fkey" FOREIGN KEY ("contractHeaderId") REFERENCES "contract_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_lines" ADD CONSTRAINT "rate_lines_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_lines" ADD CONSTRAINT "rate_lines_originScopeId_fkey" FOREIGN KEY ("originScopeId") REFERENCES "geography_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_lines" ADD CONSTRAINT "rate_lines_destinationScopeId_fkey" FOREIGN KEY ("destinationScopeId") REFERENCES "geography_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_lines" ADD CONSTRAINT "charge_lines_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_lines" ADD CONSTRAINT "charge_lines_normalizedChargeCodeId_fkey" FOREIGN KEY ("normalizedChargeCodeId") REFERENCES "normalized_charge_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_lines" ADD CONSTRAINT "charge_lines_geographyScopeId_fkey" FOREIGN KEY ("geographyScopeId") REFERENCES "geography_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_time_rules" ADD CONSTRAINT "free_time_rules_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_time_rules" ADD CONSTRAINT "free_time_rules_geographyScopeId_fkey" FOREIGN KEY ("geographyScopeId") REFERENCES "geography_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_staging_rows" ADD CONSTRAINT "import_staging_rows_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Immutability: when approvalStatus and status are both APPROVED, the version row and its line tables are frozen.
CREATE OR REPLACE FUNCTION tariff_contract_version_is_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."approvalStatus" = 'APPROVED'::"TariffApprovalStatus"
       AND OLD."status" = 'APPROVED'::"TariffContractStatus" THEN
      RAISE EXCEPTION 'tariff.immutable_version: cannot update approved contract version %', OLD."id";
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD."approvalStatus" = 'APPROVED'::"TariffApprovalStatus"
       AND OLD."status" = 'APPROVED'::"TariffContractStatus" THEN
      RAISE EXCEPTION 'tariff.immutable_version: cannot delete approved contract version %', OLD."id";
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tariff_contract_versions_immutable
BEFORE UPDATE OR DELETE ON "contract_versions"
FOR EACH ROW EXECUTE PROCEDURE tariff_contract_version_is_frozen();

CREATE OR REPLACE FUNCTION tariff_version_lines_guard()
RETURNS TRIGGER AS $$
DECLARE
  a "TariffApprovalStatus";
  s "TariffContractStatus";
  vid TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    vid := OLD."contractVersionId";
  ELSE
    vid := NEW."contractVersionId";
  END IF;

  SELECT cv."approvalStatus", cv."status" INTO a, s
  FROM "contract_versions" cv
  WHERE cv."id" = vid;

  IF FOUND AND a = 'APPROVED'::"TariffApprovalStatus" AND s = 'APPROVED'::"TariffContractStatus" THEN
    RAISE EXCEPTION 'tariff.immutable_lines: cannot mutate lines for approved contract version %', vid;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."contractVersionId" IS DISTINCT FROM NEW."contractVersionId" THEN
    SELECT cv."approvalStatus", cv."status" INTO a, s
    FROM "contract_versions" cv
    WHERE cv."id" = OLD."contractVersionId";
    IF FOUND AND a = 'APPROVED'::"TariffApprovalStatus" AND s = 'APPROVED'::"TariffContractStatus" THEN
      RAISE EXCEPTION 'tariff.immutable_lines: cannot reassign line from approved contract version';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tariff_rate_lines_guard
BEFORE INSERT OR UPDATE OR DELETE ON "rate_lines"
FOR EACH ROW EXECUTE PROCEDURE tariff_version_lines_guard();

CREATE TRIGGER trg_tariff_charge_lines_guard
BEFORE INSERT OR UPDATE OR DELETE ON "charge_lines"
FOR EACH ROW EXECUTE PROCEDURE tariff_version_lines_guard();

CREATE TRIGGER trg_tariff_free_time_rules_guard
BEFORE INSERT OR UPDATE OR DELETE ON "free_time_rules"
FOR EACH ROW EXECUTE PROCEDURE tariff_version_lines_guard();

-- Reporting views (starter pack 002)
CREATE OR REPLACE VIEW v_contract_latest_versions AS
SELECT cv.*
FROM "contract_versions" cv
INNER JOIN (
  SELECT "contractHeaderId", MAX("versionNo") AS max_version_no
  FROM "contract_versions"
  GROUP BY "contractHeaderId"
) latest ON latest."contractHeaderId" = cv."contractHeaderId"
  AND latest.max_version_no = cv."versionNo";

CREATE OR REPLACE VIEW v_provider_contract_summary AS
SELECT
  ch."id" AS contract_id,
  ch."tenantId",
  ch."legalEntityId",
  ch."providerId",
  ch."transportMode",
  ch."contractNumber",
  ch."title",
  ch."status" AS header_status,
  lv."versionNo" AS latest_version_no,
  lv."status" AS latest_version_status,
  lv."validFrom",
  lv."validTo"
FROM "contract_headers" ch
LEFT JOIN v_contract_latest_versions lv ON lv."contractHeaderId" = ch."id";
