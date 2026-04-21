import { z } from "zod";

import type { TwinEntityRef } from "@/lib/supply-chain-twin/types";

/** GET `/api/supply-chain-twin/entities` — search string (optional). */
export const twinEntitiesQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(256)
    .optional()
    .transform((value) => value ?? ""),
});

export type TwinEntitiesQuery = z.infer<typeof twinEntitiesQuerySchema>;

/** Stub catalog response; items gain shape when wired to persistence. */
export type TwinEntityListItem = { ref: TwinEntityRef };

export type TwinEntitiesListResponse = {
  items: TwinEntityListItem[];
};

export function parseTwinEntitiesQuery(searchParams: URLSearchParams): {
  ok: true;
  query: TwinEntitiesQuery;
} | {
  ok: false;
  error: string;
} {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = twinEntitiesQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.q?.[0] ?? parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, query: parsed.data };
}
