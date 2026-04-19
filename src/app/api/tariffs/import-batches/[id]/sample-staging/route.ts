import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { updateTariffImportBatch } from "@/lib/tariff/import-batches";
import {
  createTariffImportStagingRows,
  deleteStagingRowsForBatch,
} from "@/lib/tariff/import-staging-rows";
import { STAGING_RAW_PAYLOAD_KEYS } from "@/lib/tariff/import-batch-statuses";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

/**
 * Inserts non-OCR sample rows so the staging grid and future mappers can be exercised.
 * Real parsing will replace this endpoint or run asynchronously after upload.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id: batchId } = await context.params;

  let replace = false;
  const raw = await request.text().catch(() => "");
  if (raw) {
    try {
      const body = JSON.parse(raw) as { replace?: unknown };
      if (body && typeof body === "object" && body.replace === true) replace = true;
    } catch {
      /* ignore invalid body */
    }
  }

  try {
    if (replace) {
      await deleteStagingRowsForBatch(tenant.id, batchId);
    }

    await createTariffImportStagingRows(tenant.id, batchId, [
      {
        rowType: "SKELETON_PREVIEW",
        rawPayload: {
          [STAGING_RAW_PAYLOAD_KEYS.rawChargeName]: "BAF / LSFO",
          [STAGING_RAW_PAYLOAD_KEYS.rawGeoOriginLabel]: "South China",
          [STAGING_RAW_PAYLOAD_KEYS.rawGeoDestinationLabel]: "USWC",
          [STAGING_RAW_PAYLOAD_KEYS.sourceRowRef]: "Sheet1!A42",
          note: "Placeholder row for UI wiring; no parser ran.",
        },
        normalizedPayload: {
          mappedChargeCodeId: null,
          mappedOriginGeographyGroupId: null,
          mappedDestinationGeographyGroupId: null,
        },
        unresolvedFlags: {
          charge: "UNMAPPED_RAW_LABEL",
          geography: "UNMAPPED_ALIAS",
        },
      },
      {
        rowType: "SKELETON_PREVIEW",
        rawPayload: {
          [STAGING_RAW_PAYLOAD_KEYS.rawChargeName]: "THC Origin",
          [STAGING_RAW_PAYLOAD_KEYS.rawGeoOriginLabel]: "Yantian (CNYTN)",
          [STAGING_RAW_PAYLOAD_KEYS.rawGeoDestinationLabel]: "",
          [STAGING_RAW_PAYLOAD_KEYS.sourceRowRef]: "Sheet1!A43",
        },
        normalizedPayload: {
          mappedChargeCodeId: null,
          mappedOriginGeographyGroupId: null,
          mappedDestinationGeographyGroupId: null,
        },
        unresolvedFlags: { charge: "UNMAPPED_RAW_LABEL" },
      },
    ]);

    const batch = await updateTariffImportBatch(tenant.id, batchId, {
      parseStatus: "PARSED_PARTIAL",
      reviewStatus: "IN_REVIEW",
    });

    await recordTariffAuditLog({
      objectType: "import_batch",
      objectId: batchId,
      action: "sample_staging",
      userId: actorId,
      newValue: { parseStatus: batch.parseStatus, reviewStatus: batch.reviewStatus, replace },
    });

    return NextResponse.json({ ok: true, batch });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
