import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn } from "../_lib/sctwin-api-log";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { parseTwinScenarioDraftCreateBody } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-create";
import { createScenarioDraft } from "@/lib/supply-chain-twin/scenarios-draft-repo";

export const dynamic = "force-dynamic";

const ROUTE = "POST /api/supply-chain-twin/scenarios";

/**
 * Creates a tenant-scoped scenario **draft** (JSON blob only). Same auth / visibility as other twin APIs.
 * Request body is validated with Zod and never written to structured logs.
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
        route: ROUTE,
        phase: "validation",
        errorCode: "BODY_JSON_INVALID",
      });
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = parseTwinScenarioDraftCreateBody(raw);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "BODY_VALIDATION_FAILED",
      });
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const row = await createScenarioDraft(access.tenant.id, {
      title: parsed.body.title ?? null,
      draft: parsed.body.draft as Prisma.InputJsonValue,
    });

    return NextResponse.json(
      {
        id: row.id,
        title: row.title,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "scenarios",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
