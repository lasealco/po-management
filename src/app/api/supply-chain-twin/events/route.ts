import type { Prisma } from "@prisma/client";

import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiErrorJson,
  twinApiJson,
} from "../_lib/sctwin-api-log";
import {
  appendIngestEvent,
  TWIN_INGEST_IDEMPOTENCY_KEY_MAX_LEN,
  TWIN_INGEST_PAYLOAD_TOO_LARGE,
  TwinIngestPayloadTooLargeError,
} from "@/lib/supply-chain-twin/ingest-writer";
import { prisma } from "@/lib/prisma";
import { TWIN_API_ERROR_CODES } from "@/lib/supply-chain-twin/error-codes";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

import {
  twinEventsListResponseSchema,
  twinIngestEventAppendResponseSchema,
} from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import {
  decodeTwinEventsCursor,
  encodeTwinEventsCursor,
  parseTwinEventsQuery,
  twinEventsTypePrismaFilter,
} from "@/lib/supply-chain-twin/schemas/twin-events-query";
import { parseTwinIngestEventAppendBody } from "@/lib/supply-chain-twin/schemas/twin-ingest-event-append";

export const dynamic = "force-dynamic";

const ROUTE_GET = "GET /api/supply-chain-twin/events";
const ROUTE_POST = "POST /api/supply-chain-twin/events";
const TWIN_EVENTS_ERROR_QUERY_VALIDATION_FAILED = TWIN_API_ERROR_CODES.QUERY_VALIDATION_FAILED;
const TWIN_EVENTS_ERROR_INVALID_CURSOR = TWIN_API_ERROR_CODES.INVALID_CURSOR;
const TWIN_EVENTS_ERROR_BODY_JSON_INVALID = TWIN_API_ERROR_CODES.BODY_JSON_INVALID;
const TWIN_EVENTS_ERROR_BODY_VALIDATION_FAILED = TWIN_API_ERROR_CODES.BODY_VALIDATION_FAILED;
const TWIN_EVENTS_ERROR_INVALID_IDEMPOTENCY_KEY = TWIN_API_ERROR_CODES.INVALID_IDEMPOTENCY_KEY;
const TWIN_EVENTS_ERROR_INVALID_INGEST_TYPE = TWIN_API_ERROR_CODES.INVALID_TWIN_INGEST_TYPE;

function parseIdempotencyKeyHeader(
  request: Request,
): { ok: true; key: string | null } | { ok: false; error: string } {
  const raw =
    request.headers.get("Idempotency-Key") ??
    request.headers.get("idempotency-key") ??
    request.headers.get("IDEMPOTENCY-KEY");
  if (raw == null) {
    return { ok: true, key: null };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, key: null };
  }
  if (trimmed.length > TWIN_INGEST_IDEMPOTENCY_KEY_MAX_LEN) {
    return {
      ok: false,
      error: `Idempotency-Key exceeds maximum length (${TWIN_INGEST_IDEMPOTENCY_KEY_MAX_LEN} characters).`,
    };
  }
  return { ok: true, key: trimmed };
}

export type TwinIngestEventListItem = {
  id: string;
  type: string;
  createdAt: string;
  payload?: unknown;
};

/**
 * Recent twin ingest events (tenant-scoped, keyset-paged). Same auth as other twin APIs.
 * By default each row includes `payload`; omit with `includePayload=false` (never written to structured logs).
 *
 * **Query `type`:** optional filter on event `type` — exact (`type=entity_upsert`) or prefix
 * (`type=entity_*` → `startsWith("entity_")`). Unknown values yield an empty `events` array (200). Legacy
 * **`eventType`** is accepted when `type` is omitted.
 *
 * **Query `since` / `until` (Slice 68):** optional ISO-8601 bounds (same format as cursor timestamps, e.g. `…Z`).
 * Both must appear together. `since` ≤ `until`; maximum window length is **31 days** (see
 * `TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS` in `twin-events-query.ts`). Oversized or inverted ranges return **400**. A valid
 * window with no rows returns **200** and `events: []`.
 *
 * **Query `includePayload` (Slice 69):** optional boolean (`true` / `false` / `1` / `0`). Default **true** (full rows).
 * **`false`** omits `payload` from each event and avoids reading `payloadJson` from the database.
 */
export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    }
    const { access } = gate;

    const url = new URL(request.url);
    const parsed = parseTwinEventsQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE_GET,
        phase: "validation",
        errorCode: TWIN_EVENTS_ERROR_QUERY_VALIDATION_FAILED,
        requestId,
      });
      return twinApiErrorJson(parsed.error, 400, requestId, TWIN_EVENTS_ERROR_QUERY_VALIDATION_FAILED);
    }

    let cursorPos: { createdAt: Date; id: string } | null = null;
    if (parsed.query.cursor) {
      const decoded = decodeTwinEventsCursor(parsed.query.cursor);
      if (!decoded.ok) {
        logSctwinApiWarn({
          route: ROUTE_GET,
          phase: "validation",
          errorCode: TWIN_EVENTS_ERROR_INVALID_CURSOR,
          requestId,
        });
        return twinApiErrorJson("Invalid cursor", 400, requestId, TWIN_EVENTS_ERROR_INVALID_CURSOR);
      }
      cursorPos = { createdAt: decoded.createdAt, id: decoded.id };
    }

    const limit = parsed.query.limit;
    const tenantId = access.tenant.id;

    const timeWindow =
      parsed.query.since != null && parsed.query.until != null
        ? {
            createdAt: {
              gte: new Date(parsed.query.since),
              lte: new Date(parsed.query.until),
            },
          }
        : {};

    const where: Prisma.SupplyChainTwinIngestEventWhereInput = {
      tenantId,
      ...timeWindow,
      ...(parsed.query.type ? { type: twinEventsTypePrismaFilter(parsed.query.type) } : {}),
      ...(cursorPos
        ? {
            OR: [
              { createdAt: { lt: cursorPos.createdAt } },
              {
                AND: [{ createdAt: cursorPos.createdAt }, { id: { lt: cursorPos.id } }],
              },
            ],
          }
        : {}),
    };

    const includePayload = parsed.query.includePayload;

    const rows = await prisma.supplyChainTwinIngestEvent.findMany({
      where,
      select: includePayload
        ? {
            id: true,
            type: true,
            createdAt: true,
            payloadJson: true,
          }
        : {
            id: true,
            type: true,
            createdAt: true,
          },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last != null
        ? encodeTwinEventsCursor({ createdAt: last.createdAt, id: last.id })
        : null;

    const events: TwinIngestEventListItem[] = pageRows.map((row) => {
      const base = {
        id: row.id,
        type: row.type,
        createdAt: row.createdAt.toISOString(),
      };
      if (includePayload && "payloadJson" in row) {
        return { ...base, payload: row.payloadJson };
      }
      return base;
    });

    if (nextCursor) {
      return twinApiJson(twinEventsListResponseSchema.parse({ events, nextCursor }), undefined, requestId);
    }
    return twinApiJson(twinEventsListResponseSchema.parse({ events }), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_GET,
      phase: "events",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}

/**
 * Append a tenant-scoped ingest event (`type` + JSON `payload`). Uses {@link appendIngestEvent} (byte cap, no payload in logs).
 * Optional `Idempotency-Key` header enables replay-safe append: duplicate requests with the same key return the same
 * logical outcome (`{ id, type }`) without inserting another row.
 *
 * **201:** `{ id, type }`. **400:** Invalid JSON, Zod validation, oversize payload (`code: TWIN_INGEST_PAYLOAD_TOO_LARGE`), or invalid type from writer.
 */
export async function POST(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    }
    const { access } = gate;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      logSctwinApiWarn({
        route: ROUTE_POST,
        phase: "validation",
        errorCode: TWIN_EVENTS_ERROR_BODY_JSON_INVALID,
        requestId,
      });
      return twinApiErrorJson("Request body must be valid JSON.", 400, requestId, TWIN_EVENTS_ERROR_BODY_JSON_INVALID);
    }

    const parsed = parseTwinIngestEventAppendBody(raw);
    if (!parsed.ok) {
      const errorCode = parsed.payloadTooLarge ? TWIN_INGEST_PAYLOAD_TOO_LARGE : TWIN_EVENTS_ERROR_BODY_VALIDATION_FAILED;
      logSctwinApiWarn({
        route: ROUTE_POST,
        phase: "validation",
        errorCode,
        requestId,
      });
      if (parsed.payloadTooLarge) {
        return twinApiErrorJson("Ingest payload exceeds maximum size.", 400, requestId, TWIN_INGEST_PAYLOAD_TOO_LARGE);
      }
      return twinApiErrorJson(parsed.error, 400, requestId, TWIN_EVENTS_ERROR_BODY_VALIDATION_FAILED);
    }

    const idempotency = parseIdempotencyKeyHeader(request);
    if (!idempotency.ok) {
      logSctwinApiWarn({
        route: ROUTE_POST,
        phase: "validation",
        errorCode: TWIN_EVENTS_ERROR_INVALID_IDEMPOTENCY_KEY,
        requestId,
      });
      return twinApiErrorJson(idempotency.error, 400, requestId, TWIN_EVENTS_ERROR_INVALID_IDEMPOTENCY_KEY);
    }

    try {
      const { id, type } = await appendIngestEvent({
        tenantId: access.tenant.id,
        type: parsed.body.type,
        payload: parsed.body.payload as Prisma.InputJsonValue,
        ...(idempotency.key != null ? { idempotencyKey: idempotency.key } : {}),
      });
      return twinApiJson(twinIngestEventAppendResponseSchema.parse({ id, type }), { status: 201 }, requestId);
    } catch (caught) {
      if (caught instanceof TwinIngestPayloadTooLargeError) {
        logSctwinApiWarn({
          route: ROUTE_POST,
          phase: "validation",
          errorCode: TWIN_INGEST_PAYLOAD_TOO_LARGE,
          requestId,
        });
        return twinApiErrorJson("Ingest payload exceeds maximum size.", 400, requestId, TWIN_INGEST_PAYLOAD_TOO_LARGE);
      }
      if (caught instanceof RangeError && caught.message === "INVALID_TWIN_INGEST_TYPE") {
        logSctwinApiWarn({
          route: ROUTE_POST,
          phase: "validation",
          errorCode: TWIN_EVENTS_ERROR_INVALID_INGEST_TYPE,
          requestId,
        });
        return twinApiErrorJson("Invalid ingest event type.", 400, requestId, TWIN_EVENTS_ERROR_INVALID_INGEST_TYPE);
      }
      throw caught;
    }
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_POST,
      phase: "events",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}
