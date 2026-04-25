import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { answerProductImpact } from "@/lib/assistant/impact-answer";
import { getActorUserId, getViewerGrantSet, requireApiGrant, userHasGlobalGrant, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return toApiErrorResponse({ error: "You need org.orders view for impact answers.", code: "FORBIDDEN", status: 403 });
  }
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const text = typeof o.text === "string" ? o.text.trim() : "";
  const resolvedProductId = typeof o.resolvedProductId === "string" ? o.resolvedProductId.trim() : "";
  if (!text) {
    return toApiErrorResponse({ error: "text is required.", code: "BAD_INPUT", status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const canWms = await userHasGlobalGrant(actorId, "org.wms", "view");

  const out = await answerProductImpact({
    tenantId: tenant.id,
    actorUserId: actorId,
    text,
    canWms,
    resolvedProductId: resolvedProductId || null,
  });
  return NextResponse.json(out);
}
