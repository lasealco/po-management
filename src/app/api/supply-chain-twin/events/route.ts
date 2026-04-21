import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn } from "../_lib/sctwin-api-log";
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
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return NextResponse.json({ error: gate.denied.error }, { status: gate.denied.status });
    }
    const { access } = gate;

    const url = new URL(request.url);
    const parsed = parseTwinEventsQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE_GET,
        phase: "validation",
        errorCode: "QUERY_VALIDATION_FAILED",
      });
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let cursorPos: { createdAt: Date; id: string } | null = null;
    if (parsed.query.cursor) {
      const decoded = decodeTwinEventsCursor(parsed.query.cursor);
      if (!decoded.ok) {
        logSctwinApiWarn({
          route: ROUTE_GET,
          phase: "validation",
          errorCode: "INVALID_CURSOR",
        });
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
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
      return NextResponse.json(twinEventsListResponseSchema.parse({ events, nextCursor }));
    }
    return NextResponse.json(twinEventsListResponseSchema.parse({ events }));
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_GET,
      phase: "events",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Append a tenant-scoped ingest event (`type` + JSON `payload`). Uses {@link appendIngestEvent} (byte cap, no payload in logs).
 *
 * **201:** `{ id, type }`. **400:** Invalid JSON, Zod validation, oversize payload (`code: TWIN_INGEST_PAYLOAD_TOO_LARGE`), or invalid type from writer.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return NextResponse.json({ error: gate.denied.error }, { status: gate.denied.status });
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
      });
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = parseTwinIngestEventAppendBody(raw);
    if (!parsed.ok) {
      const errorCode = parsed.payloadTooLarge ? TWIN_INGEST_PAYLOAD_TOO_LARGE : "BODY_VALIDATION_FAILED";
      logSctwinApiWarn({
        route: ROUTE_POST,
        phase: "validation",
        errorCode,
      });
      if (parsed.payloadTooLarge) {
        return NextResponse.json(
          {
            error: "Ingest payload exceeds maximum size.",
            code: TWIN_INGEST_PAYLOAD_TOO_LARGE,
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const { id } = await appendIngestEvent({
        tenantId: access.tenant.id,
        type: parsed.body.type,
        payload: parsed.body.payload as Prisma.InputJsonValue,
      });
      return NextResponse.json(twinIngestEventAppendResponseSchema.parse({ id, type: parsed.body.type }), {
        status: 201,
      });
    } catch (caught) {
      if (caught instanceof TwinIngestPayloadTooLargeError) {
        logSctwinApiWarn({
          route: ROUTE_POST,
          phase: "validation",
          errorCode: TWIN_INGEST_PAYLOAD_TOO_LARGE,
        });
        return NextResponse.json(
          {
            error: "Ingest payload exceeds maximum size.",
            code: TWIN_INGEST_PAYLOAD_TOO_LARGE,
          },
          { status: 400 },
        );
      }
      if (caught instanceof RangeError && caught.message === "INVALID_TWIN_INGEST_TYPE") {
        logSctwinApiWarn({
          route: ROUTE_POST,
          phase: "validation",
          errorCode: "INVALID_TWIN_INGEST_TYPE",
        });
        return NextResponse.json({ error: "Invalid ingest event type." }, { status: 400 });
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
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
