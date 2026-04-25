import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, getViewerGrantSet, requireApiGrant, viewerHas } from "@/lib/authz";
import { buildAssistantInbox } from "@/lib/assistant/inbox-aggregate";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

/**
 * GET /api/assistant/inbox
 * Query: `?count=1` — returns only `{ total, producers }` for nav badge.
 */
export async function GET(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  if (!canCt && !canOrders) {
    return toApiErrorResponse({ error: "Not allowed.", code: "FORBIDDEN", status: 403 });
  }
  if (canCt) {
    const g = await requireApiGrant("org.controltower", "view");
    if (g) return g;
  }
  if (canOrders) {
    const g2 = await requireApiGrant("org.orders", "view");
    if (g2) return g2;
  }

  const url = new URL(request.url);
  const countOnly = url.searchParams.get("count") === "1" || url.searchParams.get("countOnly") === "1";

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const ctCtx = await getControlTowerPortalContext(actorId);

  const include = {
    ctAlerts: canCt,
    ctExceptions: canCt,
    soDrafts: canOrders,
  };

  const payload = await buildAssistantInbox({
    tenantId: tenant.id,
    actorUserId: actorId,
    ctCtx,
    include,
  });

  if (countOnly) {
    return NextResponse.json({
      total: payload.total,
      producers: payload.producers,
    });
  }

  return NextResponse.json({
    ok: true,
    ...payload,
  });
}
