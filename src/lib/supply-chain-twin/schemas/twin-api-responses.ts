import { TwinRiskSeverity } from "@prisma/client";
import { z } from "zod";

import { TWIN_ENTITY_KINDS } from "@/lib/supply-chain-twin/types";

import { twinEntityRefSchema } from "./twin-entity-ref";

const twinEntityCountsByKindSchema = z.object(
  Object.fromEntries(
    [...TWIN_ENTITY_KINDS, "other" as const].map((k) => [k, z.number().int().min(0)]),
  ) as unknown as Record<string, z.ZodTypeAny>,
);

/** Success body for `GET /api/supply-chain-twin/entities`. `payload` present when `fields=full` (Slice 70). */
export const twinEntitiesListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      ref: twinEntityRefSchema,
      payload: z.unknown().optional(),
    }),
  ),
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

/** Success body for `GET /api/supply-chain-twin/entities/[id]/neighbors`. */
export const twinEntityNeighborsResponseSchema = z.object({
  id: z.string().min(1),
  neighbors: z.array(
    z.object({
      edgeId: z.string().min(1),
      relation: z.string().nullable(),
      direction: z.enum(["in", "out"]),
      snapshotId: z.string().min(1),
      ref: twinEntityRefSchema,
    }),
  ),
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

/** `payload` omitted when `GET …/events?includePayload=false` (Slice 69). */
const twinIngestEventListItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  createdAt: z.string(),
  payload: z.unknown().optional(),
});

/** Success body for `GET /api/supply-chain-twin/events`. */
export const twinEventsListResponseSchema = z.object({
  events: z.array(twinIngestEventListItemSchema),
  nextCursor: z.string().min(1).optional(),
});

/** Success body for `POST /api/supply-chain-twin/events` (append ingest row). */
export const twinIngestEventAppendResponseSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
});

/** List row shape aligned with `POST` success body (`id`, `title`, `status`, `updatedAt` ISO). */
export const twinScenarioDraftListItemSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  status: z.string(),
  updatedAt: z.string(),
});

/** Success body for `GET /api/supply-chain-twin/scenarios`. */
export const twinScenariosListResponseSchema = z.object({
  items: z.array(twinScenarioDraftListItemSchema),
  nextCursor: z.string().min(1).optional(),
});

/** Success body for `GET /api/supply-chain-twin/scenarios/[id]` — full draft JSON (never logged server-side). */
export const twinScenarioDraftDetailResponseSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Stored document; same semantics as `draft` on create/update APIs. */
  draft: z.unknown(),
});

/** Success body for `GET /api/supply-chain-twin/scenarios/[id]/history` (metadata deltas only). */
export const twinScenarioHistoryListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      createdAt: z.string().datetime(),
      actorId: z.string().nullable(),
      action: z.string().min(1),
      titleBefore: z.string().nullable(),
      titleAfter: z.string().nullable(),
      statusBefore: z.string().nullable(),
      statusAfter: z.string().nullable(),
    }),
  ),
});

const twinRiskSeverityResponseSchema = z.nativeEnum(TwinRiskSeverity);

/** One row from `GET /api/supply-chain-twin/risk-signals` (aligns with Prisma `TwinRiskSeverity`). */
export const twinRiskSignalListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  severity: twinRiskSeverityResponseSchema,
  title: z.string(),
  detail: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Success body for `GET /api/supply-chain-twin/risk-signals`. */
export const twinRiskSignalsListResponseSchema = z.object({
  items: z.array(twinRiskSignalListItemSchema),
  nextCursor: z.string().min(1).optional(),
});

/** Success body for `PATCH /api/supply-chain-twin/risk-signals/[id]` (acknowledge/unacknowledge). */
export const twinRiskSignalAckPatchResponseSchema = z.object({
  id: z.string().min(1),
  acknowledged: z.boolean(),
  acknowledgedAt: z.string().datetime().nullable(),
  acknowledgedByActorId: z.string().min(1).nullable(),
});

/** Success body for `GET /api/supply-chain-twin/metrics` — counts only, tenant-scoped, plus snapshot timestamp (Slice 61). */
export const twinCatalogMetricsResponseSchema = z.object({
  entities: z.number().int().min(0),
  edges: z.number().int().min(0),
  events: z.number().int().min(0),
  scenarioDrafts: z.number().int().min(0),
  riskSignals: z.number().int().min(0),
  /** Slice 73: per-kind entity snapshot counts; unknown `entityKind` values rolled into `other`. */
  entityCountsByKind: twinEntityCountsByKindSchema,
  /** ISO-8601 instant when this payload was assembled (server clock). */
  generatedAt: z.string().datetime(),
});

export type TwinCatalogMetricsResponse = z.infer<typeof twinCatalogMetricsResponseSchema>;
