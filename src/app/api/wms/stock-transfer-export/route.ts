import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  loadStockTransferExportBf78,
  stockTransferExportBf78ToCsv,
} from "@/lib/wms/stock-transfer-export-bf78";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });

  const url = new URL(request.url);
  const warehouseId =
    url.searchParams.get("warehouseId")?.trim() || url.searchParams.get("wh")?.trim() || null;
  const rawLimit = url.searchParams.get("limit")?.trim();
  let limit: number | undefined;
  if (rawLimit) {
    const n = Number.parseInt(rawLimit, 10);
    if (Number.isFinite(n)) limit = n;
  }

  const doc = await loadStockTransferExportBf78(prisma, tenant.id, { warehouseId, limit });

  const format = url.searchParams.get("format")?.toLowerCase() ?? "";
  if (format === "csv") {
    const csv = stockTransferExportBf78ToCsv(doc);
    const whSuffix = doc.warehouseId ? `-${doc.warehouseId.slice(0, 8)}` : "";
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="stock-transfers-bf78${whSuffix}.csv"`,
      },
    });
  }

  return NextResponse.json(doc);
}
