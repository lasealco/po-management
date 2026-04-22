import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { getTariffImportBatchForTenant, updateTariffImportBatch } from "@/lib/tariff/import-batches";
import {
  TARIFF_IMPORT_PARSE_STATUS_SET,
  TARIFF_IMPORT_REVIEW_STATUS_SET,
} from "@/lib/tariff/import-batch-statuses";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { id } = await context.params;
  try {
    const batch = await getTariffImportBatchForTenant({ tenantId: tenant.id, batchId: id });
    return NextResponse.json({ batch });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id } = await context.params;

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

  const patch: Parameters<typeof updateTariffImportBatch>[2] = {};
  if (typeof o.parseStatus === "string") {
    const p = o.parseStatus.trim();
    if (!TARIFF_IMPORT_PARSE_STATUS_SET.has(p))
      return NextResponse.json({ error: "Invalid parseStatus." }, { status: 400 });
    patch.parseStatus = p;
  }
  if (typeof o.reviewStatus === "string") {
    const r = o.reviewStatus.trim();
    if (!TARIFF_IMPORT_REVIEW_STATUS_SET.has(r))
      return NextResponse.json({ error: "Invalid reviewStatus." }, { status: 400 });
    patch.reviewStatus = r;
  }
  if (typeof o.sourceReference === "string" || o.sourceReference === null) {
    patch.sourceReference = typeof o.sourceReference === "string" ? o.sourceReference.trim() || null : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const before = await getTariffImportBatchForTenant({ tenantId: tenant.id, batchId: id });
    const updated = await updateTariffImportBatch(tenant.id, id, patch);
    await recordTariffAuditLog({
      objectType: "import_batch",
      objectId: id,
      action: "patch",
      userId: actorId,
      oldValue: {
        parseStatus: before.parseStatus,
        reviewStatus: before.reviewStatus,
        sourceReference: before.sourceReference,
      },
      newValue: {
        parseStatus: updated.parseStatus,
        reviewStatus: updated.reviewStatus,
        sourceReference: updated.sourceReference,
      },
    });
    return NextResponse.json({ batch: updated });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
