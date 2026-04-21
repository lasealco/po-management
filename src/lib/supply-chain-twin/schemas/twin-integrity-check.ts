import { z } from "zod";

export const twinIntegrityCheckSummarySchema = z.object({
  checkedAt: z.string().datetime(),
  tenantId: z.string().min(1),
  ok: z.boolean(),
  totals: z.object({
    entitySnapshots: z.number().int().min(0),
    edges: z.number().int().min(0),
    scenarioDrafts: z.number().int().min(0),
    scenarioRevisions: z.number().int().min(0),
    riskSignals: z.number().int().min(0),
  }),
  issues: z.object({
    orphanEdgeFromSnapshotRefs: z.number().int().min(0),
    orphanEdgeToSnapshotRefs: z.number().int().min(0),
    orphanScenarioRevisionRefs: z.number().int().min(0),
    inconsistentRiskSignalAckMetadata: z.number().int().min(0),
  }),
  invalidReferenceCount: z.number().int().min(0),
  samples: z.object({
    orphanEdgeFromSnapshotEdgeIds: z.array(z.string().min(1)),
    orphanEdgeToSnapshotEdgeIds: z.array(z.string().min(1)),
    orphanScenarioRevisionIds: z.array(z.string().min(1)),
    inconsistentRiskSignalIds: z.array(z.string().min(1)),
  }),
});
