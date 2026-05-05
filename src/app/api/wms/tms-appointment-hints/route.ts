import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { loadTmsAppointmentHintsBf90 } from "@/lib/wms/tms-appointment-hints-bf90";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });

  const url = new URL(request.url);
  const warehouseId = (url.searchParams.get("warehouseId") ?? url.searchParams.get("wh") ?? "").trim() || null;

  const r = await loadTmsAppointmentHintsBf90(prisma, tenant.id, { warehouseId });
  if (!r.ok) {
    return toApiErrorResponse({ error: r.error, code: "NOT_FOUND", status: r.status });
  }

  return NextResponse.json(r.doc);
}
