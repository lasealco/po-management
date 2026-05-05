import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  bf83ScorecardDocToJson,
  bf83ScorecardToCsv,
  loadSupplierReceivingScorecardBf83,
  parseBf83ScorecardQuery,
} from "@/lib/wms/supplier-receiving-scorecard-bf83";
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
  const parsed = parseBf83ScorecardQuery(url.searchParams);
  if (!parsed.ok) {
    return toApiErrorResponse({
      error: parsed.error,
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
  const doc = await loadSupplierReceivingScorecardBf83(prisma, tenant.id, viewScope, parsed.query);

  const format = url.searchParams.get("format")?.toLowerCase() ?? "";
  if (format === "csv") {
    const csv = bf83ScorecardToCsv(doc);
    const safeSlug = tenant.slug.replace(/[^\w.-]+/g, "-");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="supplier-receiving-scorecard-${safeSlug}.csv"`,
      },
    });
  }

  return NextResponse.json(bf83ScorecardDocToJson(doc));
}
