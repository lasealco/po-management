import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { toScriEventDetailDto } from "@/lib/scri/event-dto";
import { getScriEventForTenant } from "@/lib/scri/event-repo";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.scri", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id } = await ctx.params;
  const row = await getScriEventForTenant(tenant.id, id);
  if (!row) {
    return toApiErrorResponse({ error: "Event not found.", code: "NOT_FOUND", status: 404 });
  }

  return NextResponse.json({ event: toScriEventDetailDto(row) });
}
