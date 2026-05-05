import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  loadMovementAuditChainBf82,
  parseMovementAuditChainQueryBf82,
} from "@/lib/wms/movement-audit-chain-bf82";
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
  const q = parseMovementAuditChainQueryBf82(url.searchParams);
  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
  const doc = await loadMovementAuditChainBf82(prisma, tenant.id, viewScope, q);
  return NextResponse.json(doc);
}
