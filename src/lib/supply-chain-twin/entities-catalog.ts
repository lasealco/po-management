import type { TwinEntityRef } from "@/lib/supply-chain-twin/types";

/** Catalog row: Prisma snapshot primary key plus graph ref (business key). `payload` only when `fields=full`. */
export type TwinEntityListItem = { id: string; ref: TwinEntityRef; payload?: unknown };

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
