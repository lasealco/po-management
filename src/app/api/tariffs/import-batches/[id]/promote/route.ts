import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parsePromoteImportRequestBody } from "@/app/api/tariffs/import-batches/_lib/promote-import-body";
import { jsonFromTariffError, toTariffApiErrorBody } from "@/app/api/tariffs/_lib/tariff-api-error";
import { promoteApprovedStagingRowsToNewVersion } from "@/lib/tariff/promote-staging-import";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id: batchId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(toTariffApiErrorBody("Invalid JSON.", "BAD_INPUT"), { status: 400 });
  }
  const parsed = parsePromoteImportRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json(toTariffApiErrorBody(parsed.error, "BAD_INPUT"), { status: 400 });
  }
  const { contractHeaderId } = parsed;

  try {
    const result = await promoteApprovedStagingRowsToNewVersion({
      tenantId: tenant.id,
      importBatchId: batchId,
      contractHeaderId,
      actorUserId: actorId,
    });
    return NextResponse.json(result);
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
