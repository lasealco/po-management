import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { runScriEventMatching } from "@/lib/scri/matching/run-event-match";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.scri", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id } = await ctx.params;
  try {
    const matchedCount = await runScriEventMatching(tenant.id, id);
    return NextResponse.json({ ok: true, matchedCount });
  } catch (e) {
    console.error(e);
    return toApiErrorResponse({
      error: "Matching run failed.",
      code: "INTERNAL",
      status: 500,
    });
  }
}
