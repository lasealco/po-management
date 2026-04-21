import type { Prisma } from "@prisma/client";

import { logSctwinApiError, logSctwinApiWarn, resolveSctwinRequestId, twinApiJson } from "../_lib/sctwin-api-log";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { parseTwinScenarioDraftCreateBody } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-create";
import { twinScenariosListResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import {
  decodeTwinScenariosListCursor,
  parseTwinScenariosListQuery,
} from "@/lib/supply-chain-twin/schemas/twin-scenarios-list-query";
import { createScenarioDraft, listScenarioDraftsForTenantPage } from "@/lib/supply-chain-twin/scenarios-draft-repo";

export const dynamic = "force-dynamic";

const ROUTE_POST = "POST /api/supply-chain-twin/scenarios";
const ROUTE_GET = "GET /api/supply-chain-twin/scenarios";

/**
 * Tenant-scoped scenario drafts (newest `updatedAt` first), **keyset-paged** (no offset scan).
 *
 * **Query:** `limit` integer 1–100 (default 50). Optional opaque `cursor` from a prior response’s `nextCursor`
 * (base64url JSON `{ u: ISO8601, i: id }`).
 *
 * **Response:** `{ items, nextCursor? }` — `nextCursor` omitted when there is no further page.
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
    const parsed = parseTwinScenariosListQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE_GET,
        phase: "validation",
        errorCode: "QUERY_VALIDATION_FAILED",
        requestId,
      });
      return twinApiJson({ error: parsed.error }, { status: 400 }, requestId);
    }

    let cursorPosition: { updatedAt: Date; id: string } | null = null;
    if (parsed.query.cursor) {
      const decoded = decodeTwinScenariosListCursor(parsed.query.cursor);
      if (!decoded.ok) {
        logSctwinApiWarn({
          route: ROUTE_GET,
          phase: "validation",
          errorCode: "INVALID_CURSOR",
          requestId,
        });
        return twinApiJson({ error: "Invalid cursor" }, { status: 400 }, requestId);
      }
      cursorPosition = { updatedAt: decoded.updatedAt, id: decoded.id };
    }

    const { items, nextCursor } = await listScenarioDraftsForTenantPage(access.tenant.id, {
      limit: parsed.query.limit,
      cursorPosition,
    });

    const body = {
      items: items.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      })),
      ...(nextCursor ? { nextCursor } : {}),
    };

    return twinApiJson(twinScenariosListResponseSchema.parse(body), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_GET,
      phase: "scenarios",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}

/**
 * Creates a tenant-scoped scenario **draft** (JSON blob only). Same auth / visibility as other twin APIs.
 * Request body is validated with Zod and never written to structured logs.
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

    const parsed = parseTwinScenarioDraftCreateBody(raw);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE_POST,
        phase: "validation",
        errorCode: "BODY_VALIDATION_FAILED",
        requestId,
      });
      return twinApiJson({ error: parsed.error }, { status: 400 }, requestId);
    }

    const row = await createScenarioDraft(access.tenant.id, {
      title: parsed.body.title ?? null,
      draft: parsed.body.draft as Prisma.InputJsonValue,
    });

    return twinApiJson(
      {
        id: row.id,
        title: row.title,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      },
      { status: 201 },
      requestId,
    );
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_POST,
      phase: "scenarios",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}
