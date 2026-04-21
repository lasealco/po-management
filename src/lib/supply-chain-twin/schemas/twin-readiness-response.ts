import { z } from "zod";

/** Non-production placeholder block; see `kpi-stub.ts`. */
export const twinHealthIndexStubSchema = z.object({
  mode: z.literal("stub"),
  score: z.number().int().min(0).max(100),
  disclaimer: z.literal("non_production"),
});

/** Success body for `GET /api/supply-chain-twin/readiness`. */
export const twinReadinessResponseSchema = z.object({
  ok: z.boolean(),
  reasons: z.array(z.string()),
  healthIndex: twinHealthIndexStubSchema,
});
