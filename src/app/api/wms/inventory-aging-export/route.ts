import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  inventoryAgingExportBf91ToCsv,
  loadInventoryAgingExportBf91,
} from "@/lib/wms/inventory-aging-export-bf91";
import { parseInventoryOwnershipBf79BalanceFilter } from "@/lib/wms/inventory-ownership-bf79";

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

  const ownershipFilter = parseInventoryOwnershipBf79BalanceFilter(url.searchParams);

  const r = await loadInventoryAgingExportBf91(prisma, tenant.id, actorId, {
    warehouseId,
    ownershipFilter,
    limit,
  });

  if (!r.ok) {
    return toApiErrorResponse({ error: r.error, code: "NOT_FOUND", status: r.status });
  }

  const format = url.searchParams.get("format")?.toLowerCase() ?? "";
  if (format === "csv") {
    const csv = inventoryAgingExportBf91ToCsv(r.doc);
    const whSuffix = r.doc.warehouseId ? `-${r.doc.warehouseId.slice(0, 8)}` : "";
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventory-aging-bf91${whSuffix}.csv"`,
      },
    });
  }

  return NextResponse.json(r.doc);
}
