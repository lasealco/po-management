import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  flattenReceivingAccrualStagingToCsvRows,
  isReceivingAccrualSnapshotV1,
  receivingAccrualStagingCsvFromRows,
} from "@/lib/wms/receiving-accrual-staging";
import { loadWmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const dynamic = "force-dynamic";

function parseIsoBoundary(raw: string | null): Date | null {
  const v = raw?.trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });
  }

  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
  const url = new URL(request.url);
  const format = url.searchParams.get("format")?.toLowerCase() ?? "";

  const since = parseIsoBoundary(url.searchParams.get("since"));
  const until = parseIsoBoundary(url.searchParams.get("until"));

  const createdFilter: Prisma.DateTimeFilter = {};
  if (since) createdFilter.gte = since;
  if (until) createdFilter.lte = until;

  const stagingWhere: Prisma.WmsReceivingAccrualStagingWhereInput = {
    tenantId: tenant.id,
    shipment: viewScope.shipment,
    ...(Object.keys(createdFilter).length > 0 ? { createdAt: createdFilter } : {}),
  };

  const rows = await prisma.wmsReceivingAccrualStaging.findMany({
    where: stagingWhere,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      wmsReceiptId: true,
      shipmentId: true,
      crmAccountId: true,
      warehouseId: true,
      snapshotJson: true,
      createdAt: true,
    },
  });

  if (format === "csv") {
    const flat = rows.flatMap((r) => flattenReceivingAccrualStagingToCsvRows(r));
    const csv = receivingAccrualStagingCsvFromRows(flat);
    const fname = `receiving-accrual-staging-${tenant.slug}`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}.csv"`,
      },
    });
  }

  return NextResponse.json({
    stagings: rows.map((r) => {
      const snap = r.snapshotJson;
      const parsed = isReceivingAccrualSnapshotV1(snap) ? snap : null;
      return {
        id: r.id,
        wmsReceiptId: r.wmsReceiptId,
        shipmentId: r.shipmentId,
        crmAccountId: r.crmAccountId,
        warehouseId: r.warehouseId,
        createdAt: r.createdAt.toISOString(),
        snapshot: parsed,
        snapshotInvalid: parsed == null,
      };
    }),
    truncated: rows.length >= 500,
  });
}
