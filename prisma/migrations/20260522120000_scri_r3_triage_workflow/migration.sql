-- SCRI R3: triage (owner, review log), external task links

ALTER TABLE "ScriExternalEvent" ADD COLUMN "ownerUserId" TEXT;

CREATE INDEX "ScriExternalEvent_ownerUserId_idx" ON "ScriExternalEvent"("ownerUserId");

ALTER TABLE "ScriExternalEvent" ADD CONSTRAINT "ScriExternalEvent_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ScriEventReviewLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reviewStateFrom" "ScriEventReviewState" NOT NULL,
  "reviewStateTo" "ScriEventReviewState" NOT NULL,
  "ownerUserIdFrom" TEXT,
  "ownerUserIdTo" TEXT,
  "note" VARCHAR(2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScriEventReviewLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScriEventReviewLog_eventId_createdAt_idx" ON "ScriEventReviewLog"("eventId", "createdAt");
CREATE INDEX "ScriEventReviewLog_tenantId_createdAt_idx" ON "ScriEventReviewLog"("tenantId", "createdAt");

ALTER TABLE "ScriEventReviewLog" ADD CONSTRAINT "ScriEventReviewLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriEventReviewLog" ADD CONSTRAINT "ScriEventReviewLog_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ScriExternalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriEventReviewLog" ADD CONSTRAINT "ScriEventReviewLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ScriEventTaskLink" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "sourceModule" VARCHAR(64) NOT NULL,
  "taskRef" VARCHAR(512) NOT NULL,
  "status" VARCHAR(32),
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScriEventTaskLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScriEventTaskLink_eventId_createdAt_idx" ON "ScriEventTaskLink"("eventId", "createdAt");
CREATE INDEX "ScriEventTaskLink_tenantId_idx" ON "ScriEventTaskLink"("tenantId");

ALTER TABLE "ScriEventTaskLink" ADD CONSTRAINT "ScriEventTaskLink_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriEventTaskLink" ADD CONSTRAINT "ScriEventTaskLink_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ScriExternalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriEventTaskLink" ADD CONSTRAINT "ScriEventTaskLink_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
