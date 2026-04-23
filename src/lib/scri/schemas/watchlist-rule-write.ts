import { TwinRiskSeverity } from "@prisma/client";
import { z } from "zod";

export const scriWatchlistRuleCreateSchema = z.object({
  name: z.string().trim().min(1).max(256),
  isActive: z.boolean().optional(),
  minSeverity: z.union([z.nativeEnum(TwinRiskSeverity), z.null()]).optional(),
  eventTypes: z.array(z.string()).optional(),
  countryCodes: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

export const scriWatchlistRulePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(256).optional(),
    isActive: z.boolean().optional(),
    minSeverity: z.union([z.nativeEnum(TwinRiskSeverity), z.null()]).optional(),
    eventTypes: z.array(z.string()).optional(),
    countryCodes: z.array(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (o) =>
      o.name !== undefined ||
      o.isActive !== undefined ||
      o.minSeverity !== undefined ||
      o.eventTypes !== undefined ||
      o.countryCodes !== undefined ||
      o.sortOrder !== undefined,
    { message: "Provide at least one field to update." },
  );
