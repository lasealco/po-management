import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { updateTariffImportStagingRow } from "@/lib/tariff/import-staging-rows";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; rowId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id: batchId, rowId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;

  const patch: Parameters<typeof updateTariffImportStagingRow>[2] = {};
  if (typeof o.approved === "boolean") patch.approved = o.approved;
  if (o.normalizedPayload !== undefined) {
    patch.normalizedPayload =
      o.normalizedPayload === null ? null : (o.normalizedPayload as Prisma.InputJsonValue);
  }
  if (o.unresolvedFlags !== undefined) {
    patch.unresolvedFlags =
      o.unresolvedFlags === null ? null : (o.unresolvedFlags as Prisma.InputJsonValue);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const updated = await updateTariffImportStagingRow(tenant.id, rowId, patch);
    await recordTariffAuditLog({
      objectType: "import_staging_row",
      objectId: rowId,
      action: "patch",
      userId: actorId,
      newValue: { importBatchId: batchId, ...patch },
    });
    return NextResponse.json({ row: updated });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
