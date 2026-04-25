import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  answerSalesOrderContext,
  answerShipmentContext,
  extractContextRequest,
} from "@/lib/assistant/context-answer";
import { getActorUserId, getViewerGrantSet, requireApiGrant, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  const canControlTower = viewerHas(access.grantSet, "org.controltower", "view");
  if (!canOrders && !canControlTower) {
    return toApiErrorResponse({ error: "Not allowed.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const text = body && typeof body === "object" ? (body as Record<string, unknown>).text : null;
  if (typeof text !== "string" || !text.trim()) {
    return toApiErrorResponse({ error: "text is required.", code: "BAD_INPUT", status: 400 });
  }

  const requestContext = extractContextRequest(text.trim());
  if (!requestContext) return NextResponse.json({ kind: "defer" as const });

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  if (requestContext.kind === "sales_order") {
    const gate = await requireApiGrant("org.orders", "view");
    if (gate) return gate;
    const out = await answerSalesOrderContext({ tenantId: tenant.id, token: requestContext.token });
    return NextResponse.json(out);
  }

  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;
  const out = await answerShipmentContext({
    tenantId: tenant.id,
    actorUserId: actorId,
    token: requestContext.token,
  });
  return NextResponse.json(out);
}
