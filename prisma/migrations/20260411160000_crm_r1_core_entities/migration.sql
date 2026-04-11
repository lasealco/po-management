-- CreateEnum
CREATE TYPE "CrmLeadStatus" AS ENUM ('NEW', 'WORKING', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "CrmAccountType" AS ENUM ('CUSTOMER', 'PROSPECT', 'PARTNER', 'AGENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmAccountLifecycle" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CrmOpportunityStage" AS ENUM (
  'IDENTIFIED',
  'QUALIFIED',
  'DISCOVERY',
  'SOLUTION_DESIGN',
  'PROPOSAL_SUBMITTED',
  'NEGOTIATION',
  'VERBAL_AGREEMENT',
  'WON_IMPLEMENTATION_PENDING',
  'WON_LIVE',
  'LOST',
  'ON_HOLD'
);

-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('TASK', 'CALL', 'MEETING', 'NOTE', 'EMAIL');

-- CreateTable
CREATE TABLE "CrmLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" "CrmLeadStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "serviceInterest" TEXT,
    "qualificationNotes" TEXT,
    "estimatedAnnualSpend" DECIMAL(14,2),
    "targetStartDate" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "convertedAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "website" TEXT,
    "accountType" "CrmAccountType" NOT NULL DEFAULT 'PROSPECT',
    "lifecycle" "CrmAccountLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "industry" TEXT,
    "segment" TEXT,
    "strategicFlag" BOOLEAN NOT NULL DEFAULT false,
    "parentAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "department" TEXT,
    "decisionRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "primaryContactId" TEXT,
    "name" TEXT NOT NULL,
    "stage" "CrmOpportunityStage" NOT NULL DEFAULT 'IDENTIFIED',
    "probability" INTEGER NOT NULL DEFAULT 10,
    "forecastCategory" TEXT,
    "estimatedRevenue" DECIMAL(14,2),
    "estimatedNetRevenue" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "closeDate" TIMESTAMP(3),
    "nextStep" TEXT,
    "nextStepDate" TIMESTAMP(3),
    "competitorName" TEXT,
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "type" "CrmActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "relatedAccountId" TEXT,
    "relatedContactId" TEXT,
    "relatedOpportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmLead_tenantId_status_idx" ON "CrmLead"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CrmLead_tenantId_ownerUserId_idx" ON "CrmLead"("tenantId", "ownerUserId");

-- CreateIndex
CREATE INDEX "CrmLead_tenantId_createdAt_idx" ON "CrmLead"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmAccount_tenantId_lifecycle_idx" ON "CrmAccount"("tenantId", "lifecycle");

-- CreateIndex
CREATE INDEX "CrmAccount_tenantId_ownerUserId_idx" ON "CrmAccount"("tenantId", "ownerUserId");

-- CreateIndex
CREATE INDEX "CrmAccount_tenantId_name_idx" ON "CrmAccount"("tenantId", "name");

-- CreateIndex
CREATE INDEX "CrmContact_tenantId_accountId_idx" ON "CrmContact"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "CrmContact_tenantId_email_idx" ON "CrmContact"("tenantId", "email");

-- CreateIndex
CREATE INDEX "CrmOpportunity_tenantId_stage_idx" ON "CrmOpportunity"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "CrmOpportunity_tenantId_ownerUserId_idx" ON "CrmOpportunity"("tenantId", "ownerUserId");

-- CreateIndex
CREATE INDEX "CrmOpportunity_tenantId_accountId_idx" ON "CrmOpportunity"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "CrmOpportunity_tenantId_closeDate_idx" ON "CrmOpportunity"("tenantId", "closeDate");

-- CreateIndex
CREATE INDEX "CrmActivity_tenantId_ownerUserId_idx" ON "CrmActivity"("tenantId", "ownerUserId");

-- CreateIndex
CREATE INDEX "CrmActivity_tenantId_dueDate_idx" ON "CrmActivity"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "CrmActivity_relatedAccountId_idx" ON "CrmActivity"("relatedAccountId");

-- CreateIndex
CREATE INDEX "CrmActivity_relatedOpportunityId_idx" ON "CrmActivity"("relatedOpportunityId");

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAccount" ADD CONSTRAINT "CrmAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAccount" ADD CONSTRAINT "CrmAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAccount" ADD CONSTRAINT "CrmAccount_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_relatedAccountId_fkey" FOREIGN KEY ("relatedAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_relatedContactId_fkey" FOREIGN KEY ("relatedContactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_relatedOpportunityId_fkey" FOREIGN KEY ("relatedOpportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
