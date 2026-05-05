import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  loadCapacityUtilizationSnapshotBf86,
  parseCapacityUtilizationSnapshotQueryBf86,
} from "@/lib/wms/capacity-utilization-snapshot-bf86";
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
  const parsed = parseCapacityUtilizationSnapshotQueryBf86(url.searchParams);
  if (!parsed.ok) {
    return toApiErrorResponse({
      error: parsed.error,
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
  const doc = await loadCapacityUtilizationSnapshotBf86(prisma, tenant.id, viewScope, parsed.value);
  if (!doc) {
    return toApiErrorResponse({ error: "Warehouse not found.", code: "NOT_FOUND", status: 404 });
  }

  return NextResponse.json(doc);
}
