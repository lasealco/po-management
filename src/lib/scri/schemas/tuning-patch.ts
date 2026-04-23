import { TwinRiskSeverity } from "@prisma/client";
import { z } from "zod";

export const scriTuningPatchSchema = z
  .object({
    sourceTrustMin: z.union([z.number().int().min(0).max(100), z.null()]).optional(),
    severityHighlightMin: z.union([z.nativeEnum(TwinRiskSeverity), z.null()]).optional(),
    geoAliases: z.record(z.string(), z.string()).optional(),
    automationAutoWatch: z.boolean().optional(),
    automationMinSeverity: z.nativeEnum(TwinRiskSeverity).optional(),
    automationActorUserId: z.union([z.string().min(1), z.null()]).optional(),
  })
  .refine(
    (o) =>
      o.sourceTrustMin !== undefined ||
      o.severityHighlightMin !== undefined ||
      o.geoAliases !== undefined ||
      o.automationAutoWatch !== undefined ||
      o.automationMinSeverity !== undefined ||
      o.automationActorUserId !== undefined,
    { message: "Provide at least one tuning field to update." },
  );

export type ScriTuningPatch = z.infer<typeof scriTuningPatchSchema>;
