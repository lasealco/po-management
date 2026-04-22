import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
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
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id: batchId, rowId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;

  const patch: Parameters<typeof updateTariffImportStagingRow>[3] = {};
  if (typeof o.approved === "boolean") patch.approved = o.approved;
  if (o.normalizedPayload !== undefined) {
    if (o.normalizedPayload !== null && (typeof o.normalizedPayload !== "object" || Array.isArray(o.normalizedPayload))) {
      return toApiErrorResponse({
        error: "normalizedPayload must be null or a JSON object.",
        code: "BAD_INPUT",
        status: 400,
      });
    }
    patch.normalizedPayload =
      o.normalizedPayload === null ? null : (o.normalizedPayload as Prisma.InputJsonValue);
  }
  if (o.unresolvedFlags !== undefined) {
    if (o.unresolvedFlags !== null && (typeof o.unresolvedFlags !== "object" || Array.isArray(o.unresolvedFlags))) {
      return toApiErrorResponse({
        error: "unresolvedFlags must be null or a JSON object.",
        code: "BAD_INPUT",
        status: 400,
      });
    }
    patch.unresolvedFlags =
      o.unresolvedFlags === null ? null : (o.unresolvedFlags as Prisma.InputJsonValue);
  }

  if (Object.keys(patch).length === 0) {
    return toApiErrorResponse({ error: "No valid fields to update.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const updated = await updateTariffImportStagingRow(tenant.id, batchId, rowId, patch);
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
