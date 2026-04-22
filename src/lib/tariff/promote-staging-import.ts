import { TariffLineRateType } from "@prisma/client";

import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { createTariffChargeLine } from "@/lib/tariff/charge-lines";
import { createTariffContractVersion } from "@/lib/tariff/contract-versions";
import { getTariffImportBatchForTenant, updateTariffImportBatch } from "@/lib/tariff/import-batches";
import { TARIFF_IMPORT_STAGING_ROW_TYPE_SET } from "@/lib/tariff/import-pipeline";
import { createTariffRateLine } from "@/lib/tariff/rate-lines";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";
import { prisma } from "@/lib/prisma";

const RATE_ROW = "RATE_LINE_CANDIDATE";
const CHARGE_ROW = "CHARGE_LINE_CANDIDATE";
const TARIFF_LINE_RATE_TYPE_SET = new Set<string>(Object.values(TariffLineRateType));

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function pickString(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function pickOptionalString(o: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in o)) return undefined;
  const v = o[key];
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : null;
}

function buildNormalizedPromoteRowKey(rowType: string, payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const normalizedPayload = keys
    .map((key) => [key, payload[key]] as const)
    .filter(([, value]) => value !== undefined);
  return JSON.stringify([rowType, normalizedPayload]);
}

export function findDuplicatePromotableRows(
  rows: Array<{ id: string; rowType: string; normalizedPayload: unknown }>,
): { duplicateRowId: string; firstRowId: string } | null {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!isRecord(row.normalizedPayload)) continue;
    const key = buildNormalizedPromoteRowKey(row.rowType, row.normalizedPayload);
    const first = seen.get(key);
    if (first) return { duplicateRowId: row.id, firstRowId: first };
    seen.set(key, row.id);
  }
  return null;
}

export function isSupportedPromoteRateType(rateType: unknown): rateType is TariffLineRateType {
  return typeof rateType === "string" && TARIFF_LINE_RATE_TYPE_SET.has(rateType);
}

/** Whether a staging row `normalizedPayload.amount` is acceptable for Excel promote (exported for tests). */
export function promoteStagingImportAmountPresent(amount: unknown): boolean {
  if (amount === 0 || amount === "0") return true;
  if (typeof amount === "number") return Number.isFinite(amount);
  if (typeof amount === "string") {
    const normalized = amount.trim();
    if (!normalized) return false;
    return Number.isFinite(Number(normalized));
  }
  return false;
}

/** Ensures every approved promotable row has an object `normalizedPayload` before creating a contract version. */
export function assertApprovedPromotablePayloadsAreObjects(
  rows: Array<{ id: string; normalizedPayload: unknown }>,
): void {
  for (const row of rows) {
    if (!isRecord(row.normalizedPayload)) {
      throw new TariffRepoError(
        "BAD_INPUT",
        `Approved staging row ${row.id} must have an object normalizedPayload before promote (fix in staging or unapprove).`,
      );
    }
  }
}

/**
 * Promotes **approved** `RATE_LINE_CANDIDATE` / `CHARGE_LINE_CANDIDATE` staging rows into a **new draft**
 * contract version on an existing header. First slice of “Excel → contract version”.
 */
export async function promoteApprovedStagingRowsToNewVersion(params: {
  tenantId: string;
  importBatchId: string;
  contractHeaderId: string;
  actorUserId: string | null;
}): Promise<{ versionId: string; rateLineCount: number; chargeLineCount: number }> {
  const batch = await getTariffImportBatchForTenant({
    tenantId: params.tenantId,
    batchId: params.importBatchId,
  });

  if (batch.reviewStatus === "APPLIED") {
    throw new TariffRepoError("CONFLICT", "Batch is already promoted.");
  }

  if (batch.reviewStatus !== "READY_TO_APPLY") {
    throw new TariffRepoError(
      "BAD_INPUT",
      "Batch reviewStatus must be READY_TO_APPLY before promote.",
    );
  }

  const header = await prisma.tariffContractHeader.findFirst({
    where: { id: params.contractHeaderId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!header) throw new TariffRepoError("NOT_FOUND", "Contract header not found for this tenant.");

  const rows = batch.stagingRows.filter(
    (r) =>
      r.approved &&
      (r.rowType === RATE_ROW || r.rowType === CHARGE_ROW) &&
      TARIFF_IMPORT_STAGING_ROW_TYPE_SET.has(r.rowType),
  );

  const duplicateRows = findDuplicatePromotableRows(rows);
  if (duplicateRows) {
    throw new TariffRepoError(
      "BAD_INPUT",
      `Duplicate approved staging row payloads detected (${duplicateRows.firstRowId} and ${duplicateRows.duplicateRowId}).`,
    );
  }

  if (rows.length === 0) {
    throw new TariffRepoError(
      "BAD_INPUT",
      "No approved RATE_LINE_CANDIDATE or CHARGE_LINE_CANDIDATE rows to promote.",
    );
  }

  assertApprovedPromotablePayloadsAreObjects(rows);

  let versionId: string | null = null;
  let rateLineCount = 0;
  let chargeLineCount = 0;

  try {
    const version = await createTariffContractVersion({
      tenantId: params.tenantId,
      contractHeaderId: params.contractHeaderId,
      sourceType: "EXCEL",
      sourceReference: `import:${params.importBatchId}`,
      approvalStatus: "PENDING",
      status: "DRAFT",
      comments: `Promoted from import batch ${params.importBatchId}`,
    });
    versionId = version.id;

    for (const row of rows) {
      const norm = row.normalizedPayload as Record<string, unknown>;

      if (row.rowType === RATE_ROW) {
        const rateType = pickString(norm, "rateType") as TariffLineRateType | null;
        const unitBasis = pickString(norm, "unitBasis");
        const currency = pickString(norm, "currency");
        const amount = norm.amount;
        if (rateType && !isSupportedPromoteRateType(rateType)) {
          throw new TariffRepoError("BAD_INPUT", `Rate staging row ${row.id} has unsupported rateType '${rateType}'.`);
        }
        if (!rateType || !unitBasis || !currency || !promoteStagingImportAmountPresent(amount)) {
          throw new TariffRepoError(
            "BAD_INPUT",
            `Rate staging row ${row.id} missing rateType, unitBasis, currency, or amount.`,
          );
        }
        await createTariffRateLine({
          tenantId: params.tenantId,
          contractVersionId: version.id,
          rateType,
          unitBasis,
          currency,
          amount: typeof amount === "number" || typeof amount === "string" ? amount : String(amount),
          equipmentType: pickOptionalString(norm, "equipmentType") ?? null,
          commodityScope: pickOptionalString(norm, "commodityScope") ?? null,
          serviceScope: pickOptionalString(norm, "serviceScope") ?? null,
          originScopeId: pickOptionalString(norm, "originScopeId") ?? null,
          destinationScopeId: pickOptionalString(norm, "destinationScopeId") ?? null,
          rawRateDescription:
            pickOptionalString(norm, "rawRateDescription") ?? `Import row ${row.id.slice(0, 8)}`,
        });
        rateLineCount += 1;
      } else if (row.rowType === CHARGE_ROW) {
        const rawChargeName = pickString(norm, "rawChargeName");
        const unitBasis = pickString(norm, "unitBasis");
        const currency = pickString(norm, "currency");
        const amount = norm.amount;
        if (!rawChargeName || !unitBasis || !currency || !promoteStagingImportAmountPresent(amount)) {
          throw new TariffRepoError(
            "BAD_INPUT",
            `Charge staging row ${row.id} missing rawChargeName, unitBasis, currency, or amount.`,
          );
        }
        await createTariffChargeLine({
          tenantId: params.tenantId,
          contractVersionId: version.id,
          rawChargeName,
          unitBasis,
          currency,
          amount: typeof amount === "number" || typeof amount === "string" ? amount : String(amount),
          normalizedChargeCodeId: pickOptionalString(norm, "normalizedChargeCodeId") ?? null,
          geographyScopeId: pickOptionalString(norm, "geographyScopeId") ?? null,
          equipmentScope: pickOptionalString(norm, "equipmentScope") ?? null,
          directionScope: pickOptionalString(norm, "directionScope") ?? null,
          conditionScope: pickOptionalString(norm, "conditionScope") ?? null,
          isIncluded: typeof norm.isIncluded === "boolean" ? norm.isIncluded : false,
          isMandatory: typeof norm.isMandatory === "boolean" ? norm.isMandatory : true,
        });
        chargeLineCount += 1;
      }
    }

    if (rateLineCount + chargeLineCount === 0) {
      throw new TariffRepoError("BAD_INPUT", "No valid normalized payloads on approved promotable rows.");
    }

    await updateTariffImportBatch(params.tenantId, params.importBatchId, {
      reviewStatus: "APPLIED",
      parseStatus: "PARSED_OK",
    });

    await recordTariffAuditLog({
      objectType: "contract_version",
      objectId: version.id,
      action: "import_promote",
      userId: params.actorUserId,
      newValue: {
        importBatchId: params.importBatchId,
        contractHeaderId: params.contractHeaderId,
        rateLineCount,
        chargeLineCount,
      },
    });

    return {
      versionId: version.id,
      rateLineCount,
      chargeLineCount,
    };
  } catch (e) {
    if (versionId) {
      await prisma.tariffContractVersion.deleteMany({ where: { id: versionId } }).catch(() => {
        /* best-effort rollback */
      });
    }
    throw e;
  }
}
