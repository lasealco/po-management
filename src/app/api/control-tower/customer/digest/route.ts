import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { buildControlTowerDigest } from "@/lib/control-tower/customer-digest";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

/**
 * Scoped shipment digest (most recently updated first; row cap `DIGEST_MAX_ITEMS` in `customer-digest.ts`).
 *
 * JSON: `generatedAt`, `digestLimit`, `itemCount`, `truncated`, `view` (`restricted`, `supplierPortal`,
 * `customerCrmAccountId`), `items` (id, shipmentNo, status, eta, lane codes, latestMilestone).
 *
 * Same `buildControlTowerDigest` data as `/control-tower/digest` (page + optional client CSV with `# control-tower-digest:` metadata).
 */
export async function GET() {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const ctx = await getControlTowerPortalContext(actorId);
  const payload = await buildControlTowerDigest({
    tenantId: tenant.id,
    ctx,
    actorUserId: actorId,
  });
  return NextResponse.json(payload);
}
