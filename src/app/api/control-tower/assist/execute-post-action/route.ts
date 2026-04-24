import { randomUUID } from "crypto";

import { toApiErrorResponseFromStatus } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { buildAssistExecutablePostBody } from "@/lib/control-tower/assist-post-action-allowlist";
import { writeCtAudit } from "@/lib/control-tower/audit";
import { handleControlTowerPost } from "@/lib/control-tower/post-actions";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type Body = {
  action?: unknown;
  payload?: unknown;
  /** Must be `true` — prevents accidental one-click mutations. */
  confirmed?: unknown;
  assistContext?: {
    lastSearchQuery?: string;
    clientRequestId?: string;
  };
};

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponseFromStatus("Tenant not found.", 404);
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  if (body.confirmed !== true) {
    return toApiErrorResponseFromStatus("confirmed must be true to run a POST action from assist.", 400);
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!action) {
    return toApiErrorResponseFromStatus("action is required", 400);
  }

  const built = buildAssistExecutablePostBody(action, body.payload);
  if (!built.ok) {
    return toApiErrorResponseFromStatus(built.error, 400);
  }

  const res = await handleControlTowerPost(tenant.id, built.body);
  if (!res.ok) {
    return res;
  }

  const actorId = await getActorUserId();
  if (actorId) {
    const ac = body.assistContext;
    const clientRequestId =
      typeof ac?.clientRequestId === "string" && ac.clientRequestId.trim() ? ac.clientRequestId.trim() : randomUUID();
    const lastSearchQuery = typeof ac?.lastSearchQuery === "string" ? ac.lastSearchQuery.slice(0, 2000) : undefined;
    let shipmentIdForAudit: string | null =
      typeof built.body.shipmentId === "string" ? built.body.shipmentId : null;
    if (!shipmentIdForAudit && action === "acknowledge_ct_alert" && typeof built.body.alertId === "string") {
      const al = await prisma.ctAlert.findFirst({
        where: { id: built.body.alertId, tenantId: tenant.id },
        select: { shipmentId: true },
      });
      shipmentIdForAudit = al?.shipmentId ?? null;
    }

    await writeCtAudit({
      tenantId: tenant.id,
      shipmentId: shipmentIdForAudit,
      entityType: "AssistPostAction",
      entityId: clientRequestId,
      action: "execute",
      actorUserId: actorId,
      payload: {
        postAction: action,
        lastSearchQuery: lastSearchQuery ?? null,
      },
    });
  }

  return res;
}
