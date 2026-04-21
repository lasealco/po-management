import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn } from "../_lib/sctwin-api-log";
import { prisma } from "@/lib/prisma";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

import { twinEventsListResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import {
  decodeTwinEventsCursor,
  encodeTwinEventsCursor,
  parseTwinEventsQuery,
} from "@/lib/supply-chain-twin/schemas/twin-events-query";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/events";

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
        route: ROUTE,
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
          route: ROUTE,
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
      route: ROUTE,
      phase: "events",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
