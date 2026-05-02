import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  executeScanEventBatch,
  parseScanEventBatchPayload,
} from "@/lib/wms/scan-event-batch";
import { gateWmsTierMutation } from "@/lib/wms/wms-mutation-grants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gateView = await requireApiGrant("org.wms", "view");
  if (gateView) return gateView;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });

  const tierGate = await gateWmsTierMutation(actorId, "operations");
  if (tierGate) return tierGate;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = parseScanEventBatchPayload(json);
  if (!parsed.ok) {
    return toApiErrorResponse({ error: parsed.error, code: "BAD_REQUEST", status: 400 });
  }

  const result = await executeScanEventBatch(tenant.id, actorId, parsed.value);
  return NextResponse.json(result.body, { status: result.status });
}
