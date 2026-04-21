import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn, resolveSctwinRequestId, withSctwinRequestId } from "../../_lib/sctwin-api-log";
import { prisma } from "@/lib/prisma";
import { TWIN_API_ERROR_CODES } from "@/lib/supply-chain-twin/error-codes";
import { runTwinExportJobWithRetry } from "@/lib/supply-chain-twin/events-export-job";
import { TWIN_EVENTS_EXPORT_MAX_ROWS } from "@/lib/supply-chain-twin/request-budgets";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { parseTwinEventsQuery, twinEventsTypePrismaFilter } from "@/lib/supply-chain-twin/schemas/twin-events-query";

export const dynamic = "force-dynamic";

const ROUTE_GET = "GET /api/supply-chain-twin/events/export";

function parseExportFormat(searchParams: URLSearchParams): { ok: true; format: "json" | "csv" } | { ok: false; error: string } {
  const raw = (searchParams.get("format") ?? "json").trim().toLowerCase();
  if (raw === "json" || raw === "csv") {
    return { ok: true, format: raw };
  }
  return { ok: false, error: "Invalid format. Use `json` or `csv`." };
}

function csvEscape(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return withSctwinRequestId(
        NextResponse.json({ error: gate.denied.error }, { status: gate.denied.status }),
        requestId,
      );
    }
    const { access } = gate;

    const url = new URL(request.url);
    const parsed = parseTwinEventsQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE_GET,
        phase: "validation",
        errorCode: TWIN_API_ERROR_CODES.QUERY_VALIDATION_FAILED,
        requestId,
      });
      return withSctwinRequestId(
        NextResponse.json({ error: parsed.error, code: TWIN_API_ERROR_CODES.QUERY_VALIDATION_FAILED }, { status: 400 }),
        requestId,
      );
    }

    const format = parseExportFormat(url.searchParams);
    if (!format.ok) {
      logSctwinApiWarn({
        route: ROUTE_GET,
        phase: "validation",
        errorCode: TWIN_API_ERROR_CODES.FORMAT_INVALID,
        requestId,
      });
      return withSctwinRequestId(
        NextResponse.json({ error: format.error, code: TWIN_API_ERROR_CODES.FORMAT_INVALID }, { status: 400 }),
        requestId,
      );
    }

    const where: Prisma.SupplyChainTwinIngestEventWhereInput = {
      tenantId: access.tenant.id,
      ...(parsed.query.since != null && parsed.query.until != null
        ? {
            createdAt: {
              gte: new Date(parsed.query.since),
              lte: new Date(parsed.query.until),
            },
          }
        : {}),
      ...(parsed.query.type ? { type: twinEventsTypePrismaFilter(parsed.query.type) } : {}),
    };

    const includePayload = parsed.query.includePayload;
    const exportJob = await runTwinExportJobWithRetry(async () =>
      prisma.supplyChainTwinIngestEvent.findMany({
        where,
        select: includePayload
          ? { id: true, type: true, createdAt: true, payloadJson: true }
          : { id: true, type: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: TWIN_EVENTS_EXPORT_MAX_ROWS + 1,
      }),
    );
    if (!exportJob.ok) {
      throw exportJob.error;
    }
    const rows = exportJob.result;

    if (rows.length > TWIN_EVENTS_EXPORT_MAX_ROWS) {
      logSctwinApiWarn({
        route: ROUTE_GET,
        phase: "validation",
        errorCode: TWIN_API_ERROR_CODES.EXPORT_ROW_CAP_EXCEEDED,
        requestId,
      });
      return withSctwinRequestId(
        NextResponse.json(
          {
            error: `Export result exceeds ${TWIN_EVENTS_EXPORT_MAX_ROWS} rows. Narrow filters and try again.`,
            code: TWIN_API_ERROR_CODES.EXPORT_ROW_CAP_EXCEEDED,
          },
          { status: 400 },
        ),
        requestId,
      );
    }

    if (format.format === "json") {
      return withSctwinRequestId(
        NextResponse.json({
          events: rows.map((row) => ({
            id: row.id,
            type: row.type,
            createdAt: row.createdAt.toISOString(),
            ...(includePayload && "payloadJson" in row ? { payload: row.payloadJson } : {}),
          })),
        }),
        requestId,
      );
    }

    const headers = includePayload
      ? ["id", "type", "createdAt", "payload"]
      : ["id", "type", "createdAt"];
    const lines = [
      headers.join(","),
      ...rows.map((row) => {
        const base = [csvEscape(row.id), csvEscape(row.type), csvEscape(row.createdAt.toISOString())];
        if (includePayload && "payloadJson" in row) {
          base.push(csvEscape(JSON.stringify(row.payloadJson)));
        }
        return base.join(",");
      }),
    ];
    const body = lines.join("\n");
    const response = new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="sctwin-events-export.csv"',
      },
    });
    return withSctwinRequestId(response, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_GET,
      phase: "events_export",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return withSctwinRequestId(NextResponse.json({ error: "Internal server error" }, { status: 500 }), requestId);
  }
}
