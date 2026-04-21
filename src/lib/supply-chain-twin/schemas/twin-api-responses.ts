import { z } from "zod";

import { twinEntityRefSchema } from "./twin-entity-ref";

/** Success body for `GET /api/supply-chain-twin/entities`. */
export const twinEntitiesListResponseSchema = z.object({
  items: z.array(z.object({ ref: twinEntityRefSchema })),
  nextCursor: z.string().min(1).optional(),
});

/**
 * Success body for `GET /api/supply-chain-twin/entities/[id]` — one snapshot row.
 * `ref.id` is the business `entityKey`; route `id` is the Prisma primary key (`cuid`).
 */
export const twinEntitySnapshotDetailResponseSchema = z.object({
  id: z.string(),
  ref: twinEntityRefSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  payload: z.unknown(),
});

/** Success body for `GET /api/supply-chain-twin/edges`. */
export const twinEdgesListResponseSchema = z.object({
  edges: z.array(
    z.object({
      id: z.string(),
      relation: z.string().nullable(),
      from: twinEntityRefSchema,
      to: twinEntityRefSchema,
    }),
  ),
});

const twinIngestEventListItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  createdAt: z.string(),
  payload: z.unknown(),
});

/** Success body for `GET /api/supply-chain-twin/events`. */
export const twinEventsListResponseSchema = z.object({
  events: z.array(twinIngestEventListItemSchema),
  nextCursor: z.string().min(1).optional(),
});
