import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { writeCtAudit } from "@/lib/control-tower/audit";
import { runSlaEscalationsForTenant } from "@/lib/control-tower/sla-escalation";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const dryRun =
    Boolean(body && typeof body === "object" && (body as Record<string, unknown>).dryRun);

  const result = await runSlaEscalationsForTenant({
    tenantId: tenant.id,
    actorUserId: actorId,
    dryRun,
  });

  await writeCtAudit({
    tenantId: tenant.id,
    shipmentId: null,
    entityType: "ControlTowerOps",
    entityId: "sla_escalation",
    action: "ops_run_sla_escalation",
    actorUserId: actorId,
    payload: result,
  });
  return NextResponse.json({ ok: true, ...result });
}
