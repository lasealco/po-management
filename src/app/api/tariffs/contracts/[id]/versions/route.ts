import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { createTariffContractVersion, listTariffContractVersionsForHeader } from "@/lib/tariff/contract-versions";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import { TARIFF_CONTRACT_VERSION_SOURCE_TYPE_SET } from "@/lib/tariff/contract-version-source-types";
import type { TariffSourceType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id: contractHeaderId } = await context.params;
  try {
    const versions = await listTariffContractVersionsForHeader({
      tenantId: tenant.id,
      contractHeaderId,
    });
    return NextResponse.json({ versions });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

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
  const sourceTypeRaw = typeof o.sourceType === "string" ? o.sourceType.trim() : "MANUAL";
  if (!TARIFF_CONTRACT_VERSION_SOURCE_TYPE_SET.has(sourceTypeRaw)) {
    return toApiErrorResponse({ error: "Invalid sourceType.", code: "BAD_INPUT", status: 400 });
  }

  const { id: contractHeaderId } = await context.params;

  try {
    const created = await createTariffContractVersion({
      tenantId: tenant.id,
      contractHeaderId,
      sourceType: sourceTypeRaw as TariffSourceType,
      sourceReference: typeof o.sourceReference === "string" ? o.sourceReference.trim() || null : null,
      sourceFileUrl: typeof o.sourceFileUrl === "string" ? o.sourceFileUrl.trim() || null : null,
      comments: typeof o.comments === "string" ? o.comments.trim() || null : null,
    });
    await recordTariffAuditLog({
      objectType: "contract_version",
      objectId: created.id,
      action: "create",
      userId: actorId,
      newValue: { contractHeaderId, versionNo: created.versionNo, sourceType: created.sourceType },
    });
    return NextResponse.json({ version: created });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
