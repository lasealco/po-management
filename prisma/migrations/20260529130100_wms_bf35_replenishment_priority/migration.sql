-- BF-35 — Replenishment rule priority, cap per run, exception tier; task lineage for Operations filtering.

ALTER TABLE "ReplenishmentRule"
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxTasksPerRun" INTEGER,
ADD COLUMN "exceptionQueue" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WmsTask"
ADD COLUMN "replenishmentRuleId" TEXT,
ADD COLUMN "replenishmentPriority" INTEGER,
ADD COLUMN "replenishmentException" BOOLEAN;

ALTER TABLE "WmsTask"
ADD CONSTRAINT "WmsTask_replenishmentRuleId_fkey"
FOREIGN KEY ("replenishmentRuleId") REFERENCES "ReplenishmentRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WmsTask_replenishmentRuleId_idx" ON "WmsTask" ("replenishmentRuleId");
