import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  buildSlottingRecommendations,
  slottingRecommendationsToCsv,
} from "@/lib/wms/slotting-recommendations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });

  const url = new URL(request.url);
  const warehouseId = (url.searchParams.get("warehouseId") ?? url.searchParams.get("wh") ?? "").trim();
  if (!warehouseId) {
    return toApiErrorResponse({
      error: "warehouseId (or wh) query parameter required.",
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const daysRaw = url.searchParams.get("days");
  const daysParsed = daysRaw != null ? Number(daysRaw) : 30;
  const windowDays = Number.isFinite(daysParsed) ? daysParsed : 30;

  const data = await buildSlottingRecommendations(prisma, tenant.id, warehouseId, windowDays);
  if (!data) {
    return toApiErrorResponse({ error: "Warehouse not found.", code: "NOT_FOUND", status: 404 });
  }

  const format = url.searchParams.get("format")?.toLowerCase() ?? "";
  if (format === "csv") {
    const csv = slottingRecommendationsToCsv(data.recommendations);
    const safeCode = (data.warehouse.code ?? data.warehouse.id).replace(/[^\w-]+/g, "-");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="slotting-recommendations-${safeCode}.csv"`,
      },
    });
  }

  return NextResponse.json(data);
}
