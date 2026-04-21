import type { TwinEntityRef } from "@/lib/supply-chain-twin/types";

/** Stub catalog row; items gain shape when wired to persistence. */
export type TwinEntityListItem = { ref: TwinEntityRef };

/**
 * API list response. `nextCursor` is opaque (base64url JSON); absent when no further pages.
 * Existing clients may read only `items` — field is additive.
 */
export type TwinEntitiesListResponse = {
  items: TwinEntityListItem[];
  nextCursor?: string | null;
};

export {
  decodeTwinEntitiesCursor,
  encodeTwinEntitiesCursor,
  parseTwinEntitiesQuery,
  twinEntitiesQuerySchema,
  type TwinEntitiesQuery,
} from "./schemas/twin-entities-query";
