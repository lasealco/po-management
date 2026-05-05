import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { loadPickPathExportBf76, pickPathExportToCsv } from "@/lib/wms/pick-path-export-bf76";
import { loadWmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });

  const url = new URL(request.url);
  const waveId = url.searchParams.get("waveId")?.trim();
  if (!waveId) {
    return toApiErrorResponse({
      error: "waveId query parameter required.",
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
  const r = await loadPickPathExportBf76(prisma, tenant.id, waveId, viewScope);
  if (!r.ok) {
    return toApiErrorResponse({ error: r.error, code: r.code, status: r.status });
  }

  const format = url.searchParams.get("format")?.toLowerCase() ?? "";
  if (format === "csv") {
    const csv = pickPathExportToCsv(r.doc);
    const safeNo = r.doc.waveNo.replace(/[^\w.-]+/g, "-");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pick-path-${safeNo}-${r.doc.waveId.slice(0, 8)}.csv"`,
      },
    });
  }

  return NextResponse.json(r.doc);
}
