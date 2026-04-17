import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getProductTracePayload } from "@/lib/product-trace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const actorUserId = await getActorUserId();
  if (!actorUserId) {
    return NextResponse.json(
      {
        error:
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const q =
    (url.searchParams.get("q") ?? url.searchParams.get("sku") ?? url.searchParams.get("code") ?? "").trim();
  if (!q) {
    return NextResponse.json(
      { error: "Missing query: use ?q= (SKU, product code, or product id)." },
      { status: 400 },
    );
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
      return NextResponse.json({ error: "Empty query." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "No product matched that SKU, code, or id in your tenant." },
      { status: 404 },
    );
  }

  return NextResponse.json(result.data);
}
