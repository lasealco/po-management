import { z } from "zod";
import { firstZodFieldError } from "./first-zod-error";

const twinEntityNeighborsQuerySchema = z.object({
  direction: z.enum(["in", "out", "both"]).optional().default("both"),
  take: z.coerce.number().int().min(1).max(500).optional().default(200),
});

export type TwinEntityNeighborsQuery = z.infer<typeof twinEntityNeighborsQuerySchema>;

export function parseTwinEntityNeighborsQuery(searchParams: URLSearchParams):
  | { ok: true; query: TwinEntityNeighborsQuery }
  | { ok: false; error: string } {
  const parsed = twinEntityNeighborsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return { ok: false, error: firstZodFieldError(parsed.error, ["direction", "take"]) };
  }
  return { ok: true, query: parsed.data };
}
