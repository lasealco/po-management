import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { getTariffImportBatchForTenant } from "@/lib/tariff/import-batches";
import { prisma } from "@/lib/prisma";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

/**
 * Inserts two **approved** promotable staging rows (BASE_RATE + BAF charge) using live geography / charge-code ids.
 * For QA only: set batch review to READY_TO_APPLY, then call POST …/promote with a draft contract header.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id: batchId } = await context.params;

  let batch: Awaited<ReturnType<typeof getTariffImportBatchForTenant>>;
  try {
    batch = await getTariffImportBatchForTenant({ tenantId: tenant.id, batchId });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }

  if (batch.reviewStatus === "APPLIED") {
    return NextResponse.json({ error: "Batch already promoted; fixture rows are not allowed." }, { status: 409 });
  }

  const groups = await prisma.tariffGeographyGroup.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    take: 2,
    select: { id: true },
  });
  if (groups.length < 2) {
    return NextResponse.json(
      { error: "Need at least two active geography groups in the database for this fixture." },
      { status: 400 },
    );
  }

  const baf = await prisma.tariffNormalizedChargeCode.findFirst({
    where: { code: "BAF", active: true },
    select: { id: true },
  });
  if (!baf) {
    return NextResponse.json(
      { error: "Normalized charge code BAF not found. Run npm run db:seed first." },
      { status: 400 },
    );
  }

  const [originScopeId, destinationScopeId] = [groups[0]!.id, groups[1]!.id];

  await prisma.tariffImportStagingRow.createMany({
    data: [
      {
        importBatchId: batchId,
        rowType: "RATE_LINE_CANDIDATE",
        rawPayload: { note: "Fixture: synthetic ocean base from import promote QA." },
        normalizedPayload: {
          kind: "RATE",
          rateType: "BASE_RATE",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: "2400",
          equipmentType: "40HC",
          serviceScope: "Fixture main leg",
          originScopeId,
          destinationScopeId,
          rawRateDescription: "Fixture BASE_RATE (import promote)",
        },
        approved: true,
      },
      {
        importBatchId: batchId,
        rowType: "CHARGE_LINE_CANDIDATE",
        rawPayload: { note: "Fixture BAF line." },
        normalizedPayload: {
          kind: "CHARGE",
          rawChargeName: "BAF (fixture)",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: "350",
          normalizedChargeCodeId: baf.id,
          equipmentScope: "40HC",
        },
        approved: true,
      },
    ],
  });

  await recordTariffAuditLog({
    objectType: "import_batch",
    objectId: batchId,
    action: "fixture_promotable_rows",
    userId: actorId,
    newValue: { originScopeId, destinationScopeId, chargeCodeId: baf.id },
  });

  return NextResponse.json({ ok: true, inserted: 2 });
}
