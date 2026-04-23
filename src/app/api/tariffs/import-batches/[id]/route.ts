import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { getTariffImportBatchForTenant, updateTariffImportBatch } from "@/lib/tariff/import-batches";
import {
  TARIFF_IMPORT_PARSE_STATUS_SET,
  TARIFF_IMPORT_REVIEW_STATUS_SET,
} from "@/lib/tariff/import-batch-statuses";
import { getDemoTenant } from "@/lib/demo-tenant";
import { confidenceScoreFromPatchBody } from "@/app/api/tariffs/_lib/confidence-score-patch-field";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

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
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id } = await context.params;

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

  const patch: Parameters<typeof updateTariffImportBatch>[2] = {};
  if (typeof o.parseStatus === "string") {
    const p = o.parseStatus.trim();
    if (!TARIFF_IMPORT_PARSE_STATUS_SET.has(p)) {
      return toApiErrorResponse({ error: "Invalid parseStatus.", code: "BAD_INPUT", status: 400 });
    }
    patch.parseStatus = p;
  }
  if (typeof o.reviewStatus === "string") {
    const r = o.reviewStatus.trim();
    if (!TARIFF_IMPORT_REVIEW_STATUS_SET.has(r)) {
      return toApiErrorResponse({ error: "Invalid reviewStatus.", code: "BAD_INPUT", status: 400 });
    }
    patch.reviewStatus = r;
  }
  if (typeof o.sourceReference === "string" || o.sourceReference === null) {
    patch.sourceReference = typeof o.sourceReference === "string" ? o.sourceReference.trim() || null : null;
  }
  const confidencePatch = confidenceScoreFromPatchBody(o);
  if (!confidencePatch.ok) {
    return toApiErrorResponse({ error: confidencePatch.message, code: "BAD_INPUT", status: 400 });
  }
  if ("confidenceScore" in confidencePatch.patch) {
    patch.confidenceScore = confidencePatch.patch.confidenceScore;
  }

  if (Object.keys(patch).length === 0) {
    return toApiErrorResponse({ error: "No valid fields to update.", code: "BAD_INPUT", status: 400 });
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
        confidenceScore: before.confidenceScore,
      },
      newValue: {
        parseStatus: updated.parseStatus,
        reviewStatus: updated.reviewStatus,
        sourceReference: updated.sourceReference,
        confidenceScore: updated.confidenceScore,
      },
    });
    return NextResponse.json({ batch: updated });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
