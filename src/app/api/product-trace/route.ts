import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getProductTracePayload } from "@/lib/product-trace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found. Run `npm run db:seed` to create starter data.", code: "NOT_FOUND", status: 404 });
  }

  const actorUserId = await getActorUserId();
  if (!actorUserId) {
    return toApiErrorResponse({ error: "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.", code: "FORBIDDEN", status: 403 });
  }

  const url = new URL(req.url);
  const q =
    (url.searchParams.get("q") ?? url.searchParams.get("sku") ?? url.searchParams.get("code") ?? "").trim();
  if (!q) {
    return toApiErrorResponse({ error: "Missing query: use ?q= (SKU, product code, or product id).", code: "BAD_INPUT", status: 400 });
  }

  const includeInventory = await userHasGlobalGrant(actorUserId, "org.wms", "view");
  const result = await getProductTracePayload({
    tenantId: tenant.id,
    actorUserId,
    query: q,
    includeInventory,
  });

  if (!result.ok) {
    if (result.error === "bad_query") {
      return toApiErrorResponse({ error: "Empty query.", code: "BAD_INPUT", status: 400 });
    }
    return toApiErrorResponse({ error: "No product matched that SKU, code, or id in your tenant.", code: "NOT_FOUND", status: 404 });
  }

  return NextResponse.json(result.data);
}
