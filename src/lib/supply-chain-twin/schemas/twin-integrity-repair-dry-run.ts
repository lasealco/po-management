import { z } from "zod";

export const twinIntegrityRepairActionSchema = z.enum([
  "delete_orphan_edge_missing_from_snapshot",
  "delete_orphan_edge_missing_to_snapshot",
  "delete_orphan_scenario_revision_missing_draft",
]);

export const twinIntegrityRepairDryRunSummarySchema = z.object({
  checkedAt: z.string().datetime(),
  tenantId: z.string().min(1),
  dryRun: z.literal(true),
  proposedFixCount: z.number().int().min(0),
  proposedFixesByType: z.object({
    delete_orphan_edge_missing_from_snapshot: z.number().int().min(0),
    delete_orphan_edge_missing_to_snapshot: z.number().int().min(0),
    delete_orphan_scenario_revision_missing_draft: z.number().int().min(0),
  }),
  proposals: z.array(
    z.object({
      action: twinIntegrityRepairActionSchema,
      targetId: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});
