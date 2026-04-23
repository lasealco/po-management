import { z } from "zod";

export const scriRecommendationStatusPatchSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED", "SNOOZED"]),
  statusNote: z.string().max(2000).optional().nullable(),
});

export type ScriRecommendationStatusPatch = z.infer<typeof scriRecommendationStatusPatchSchema>;
