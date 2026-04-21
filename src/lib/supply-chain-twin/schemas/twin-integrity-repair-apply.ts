import { z } from "zod";

import { twinIntegrityRepairActionSchema } from "./twin-integrity-repair-dry-run";

export const twinIntegrityRepairApplyBodySchema = z.object({
  confirmApply: z.literal(true),
  maxActions: z.number().int().min(1).max(5000).optional(),
});

export const twinIntegrityRepairApplySummarySchema = z.object({
  checkedAt: z.string().datetime(),
  tenantId: z.string().min(1),
  dryRun: z.literal(false),
  confirmed: z.literal(true),
  attemptedActionCount: z.number().int().min(0),
  appliedActionCount: z.number().int().min(0),
  auditRecords: z.array(
    z.object({
      action: twinIntegrityRepairActionSchema,
      targetId: z.string().min(1),
      reason: z.string().min(1),
      applied: z.boolean(),
      affectedRows: z.number().int().min(0),
    }),
  ),
});
