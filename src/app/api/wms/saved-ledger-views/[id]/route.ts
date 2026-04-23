import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.wms", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return toApiErrorResponse({ error: "Missing id.", code: "BAD_INPUT", status: 400 });
  }

  const result = await prisma.wmsSavedLedgerView.deleteMany({
    where: { id, tenantId: tenant.id, userId: actorId },
  });

  if (result.count === 0) {
    return toApiErrorResponse({ error: "Saved view not found.", code: "NOT_FOUND", status: 404 });
  }

  return NextResponse.json({ ok: true });
}
