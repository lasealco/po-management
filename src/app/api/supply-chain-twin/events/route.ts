import type { Prisma } from "@prisma/client";

import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiJson,
} from "../_lib/sctwin-api-log";
import {
  appendIngestEvent,
  TWIN_INGEST_PAYLOAD_TOO_LARGE,
  TwinIngestPayloadTooLargeError,
} from "@/lib/supply-chain-twin/ingest-writer";
import { prisma } from "@/lib/prisma";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

import {
  twinEventsListResponseSchema,
  twinIngestEventAppendResponseSchema,
} from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import {
  decodeTwinEventsCursor,
  encodeTwinEventsCursor,
  parseTwinEventsQuery,
} from "@/lib/supply-chain-twin/schemas/twin-events-query";
import { parseTwinIngestEventAppendBody } from "@/lib/supply-chain-twin/schemas/twin-ingest-event-append";

export const dynamic = "force-dynamic";

const ROUTE_GET = "GET /api/supply-chain-twin/events";
const ROUTE_POST = "POST /api/supply-chain-twin/events";

export type TwinIngestEventListItem = {
  id: string;
  type: string;
  createdAt: string;
  payload: unknown;
};

/**
 * Recent twin ingest events (tenant-scoped, keyset-paged). Same auth as other twin APIs.
 * Payloads are returned to the client but never written to structured logs.
 */
export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiJson({ error: gate.denied.error }, { status: gate.denied.status }, requestId);
    }
    const { access } = gate;

    const url = new URL(request.url);
    const parsed = parseTwinEventsQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE_GET,
        phase: "validation",
        errorCode: "QUERY_VALIDATION_FAILED",
        requestId,
      });
      return twinApiJson({ error: parsed.error }, { status: 400 }, requestId);
    }

    let cursorPos: { createdAt: Date; id: string } | null = null;
    if (parsed.query.cursor) {
      const decoded = decodeTwinEventsCursor(parsed.query.cursor);
      if (!decoded.ok) {
        logSctwinApiWarn({
          route: ROUTE_GET,
          phase: "validation",
          errorCode: "INVALID_CURSOR",
          requestId,
        });
        return twinApiJson({ error: "Invalid cursor" }, { status: 400 }, requestId);
      }
      cursorPos = { createdAt: decoded.createdAt, id: decoded.id };
    }

    const limit = parsed.query.limit;
    const tenantId = access.tenant.id;

    const where: Prisma.SupplyChainTwinIngestEventWhereInput = {
      tenantId,
      ...(parsed.query.eventType ? { type: parsed.query.eventType } : {}),
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

    const rows = await prisma.supplyChainTwinIngestEvent.findMany({
      where,
      select: {
        id: true,
        type: true,
        createdAt: true,
        payloadJson: true,
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

    const events: TwinIngestEventListItem[] = pageRows.map((row) => ({
      id: row.id,
      type: row.type,
      createdAt: row.createdAt.toISOString(),
      payload: row.payloadJson,
    }));

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
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}

/**
 * Append a tenant-scoped ingest event (`type` + JSON `payload`). Uses {@link appendIngestEvent} (byte cap, no payload in logs).
 *
 * **201:** `{ id, type }`. **400:** Invalid JSON, Zod validation, oversize payload (`code: TWIN_INGEST_PAYLOAD_TOO_LARGE`), or invalid type from writer.
 */
export async function POST(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiJson({ error: gate.denied.error }, { status: gate.denied.status }, requestId);
    }
    const { access } = gate;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      logSctwinApiWarn({
        route: ROUTE_POST,
        phase: "validation",
        errorCode: "BODY_JSON_INVALID",
        requestId,
      });
      return twinApiJson({ error: "Request body must be valid JSON." }, { status: 400 }, requestId);
    }

    const parsed = parseTwinIngestEventAppendBody(raw);
    if (!parsed.ok) {
      const errorCode = parsed.payloadTooLarge ? TWIN_INGEST_PAYLOAD_TOO_LARGE : "BODY_VALIDATION_FAILED";
      logSctwinApiWarn({
        route: ROUTE_POST,
        phase: "validation",
        errorCode,
        requestId,
      });
      if (parsed.payloadTooLarge) {
        return twinApiJson(
          {
            error: "Ingest payload exceeds maximum size.",
            code: TWIN_INGEST_PAYLOAD_TOO_LARGE,
          },
          { status: 400 },
          requestId,
        );
      }
      return twinApiJson({ error: parsed.error }, { status: 400 }, requestId);
    }

    try {
      const { id } = await appendIngestEvent({
        tenantId: access.tenant.id,
        type: parsed.body.type,
        payload: parsed.body.payload as Prisma.InputJsonValue,
      });
      return twinApiJson(twinIngestEventAppendResponseSchema.parse({ id, type: parsed.body.type }), { status: 201 }, requestId);
    } catch (caught) {
      if (caught instanceof TwinIngestPayloadTooLargeError) {
        logSctwinApiWarn({
          route: ROUTE_POST,
          phase: "validation",
          errorCode: TWIN_INGEST_PAYLOAD_TOO_LARGE,
          requestId,
        });
        return twinApiJson(
          {
            error: "Ingest payload exceeds maximum size.",
            code: TWIN_INGEST_PAYLOAD_TOO_LARGE,
          },
          { status: 400 },
          requestId,
        );
      }
      if (caught instanceof RangeError && caught.message === "INVALID_TWIN_INGEST_TYPE") {
        logSctwinApiWarn({
          route: ROUTE_POST,
          phase: "validation",
          errorCode: "INVALID_TWIN_INGEST_TYPE",
          requestId,
        });
        return twinApiJson({ error: "Invalid ingest event type." }, { status: 400 }, requestId);
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
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}
