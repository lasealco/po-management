-- RFQ / ad hoc ocean procurement foundation

CREATE TYPE "QuoteRequestStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED');

CREATE TYPE "QuoteRecipientInvitationStatus" AS ENUM ('PENDING', 'INVITED', 'DECLINED', 'RESPONDED');

CREATE TYPE "QuoteResponseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'AWARDED', 'REJECTED', 'WITHDRAWN');

CREATE TYPE "QuoteClarificationVisibility" AS ENUM ('INTERNAL', 'RECIPIENTS');

CREATE TABLE "quote_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "transportMode" "TariffTransportMode" NOT NULL DEFAULT 'OCEAN',
    "originLabel" TEXT NOT NULL,
    "destinationLabel" TEXT NOT NULL,
    "equipmentSummary" TEXT,
    "cargoDescription" TEXT,
    "quotesDueAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "lastBroadcastAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quote_request_recipients" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "supplierId" TEXT,
    "displayName" TEXT NOT NULL,
    "contactEmail" VARCHAR(320),
    "invitationStatus" "QuoteRecipientInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "lastInviteMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_request_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quote_responses" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "QuoteResponseStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "totalAllInAmount" DECIMAL(18,4),
    "validityFrom" DATE,
    "validityTo" DATE,
    "includedChargesJson" JSONB,
    "excludedChargesJson" JSONB,
    "freeTimeSummaryJson" JSONB,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quote_responses_recipientId_key" ON "quote_responses"("recipientId");

CREATE TABLE "quote_response_lines" (
    "id" TEXT NOT NULL,
    "quoteResponseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lineType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(18,4),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "unitBasis" TEXT,
    "isIncluded" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "quote_response_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quote_clarification_messages" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "recipientId" TEXT,
    "quoteResponseId" TEXT,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "visibility" "QuoteClarificationVisibility" NOT NULL DEFAULT 'INTERNAL',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_clarification_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quote_requests_tenantId_idx" ON "quote_requests"("tenantId");
CREATE INDEX "quote_requests_tenantId_status_idx" ON "quote_requests"("tenantId", "status");
CREATE INDEX "quote_request_recipients_quoteRequestId_idx" ON "quote_request_recipients"("quoteRequestId");
CREATE INDEX "quote_request_recipients_supplierId_idx" ON "quote_request_recipients"("supplierId");
CREATE INDEX "quote_responses_quoteRequestId_idx" ON "quote_responses"("quoteRequestId");
CREATE INDEX "quote_response_lines_quoteResponseId_idx" ON "quote_response_lines"("quoteResponseId");
CREATE INDEX "quote_clarification_messages_quoteRequestId_idx" ON "quote_clarification_messages"("quoteRequestId");

ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quote_request_recipients" ADD CONSTRAINT "quote_request_recipients_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_request_recipients" ADD CONSTRAINT "quote_request_recipients_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quote_responses" ADD CONSTRAINT "quote_responses_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_responses" ADD CONSTRAINT "quote_responses_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "quote_request_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quote_response_lines" ADD CONSTRAINT "quote_response_lines_quoteResponseId_fkey" FOREIGN KEY ("quoteResponseId") REFERENCES "quote_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quote_clarification_messages" ADD CONSTRAINT "quote_clarification_messages_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_clarification_messages" ADD CONSTRAINT "quote_clarification_messages_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "quote_request_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quote_clarification_messages" ADD CONSTRAINT "quote_clarification_messages_quoteResponseId_fkey" FOREIGN KEY ("quoteResponseId") REFERENCES "quote_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quote_clarification_messages" ADD CONSTRAINT "quote_clarification_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
