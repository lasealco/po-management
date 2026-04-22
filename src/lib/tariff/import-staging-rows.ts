import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export async function createTariffImportStagingRows(
  tenantId: string,
  importBatchId: string,
  rows: {
    rowType: string;
    rawPayload: Prisma.InputJsonValue;
    normalizedPayload?: Prisma.InputJsonValue | null;
    unresolvedFlags?: Prisma.InputJsonValue | null;
  }[],
) {
  const batch = await prisma.tariffImportBatch.findFirst({
    where: { id: importBatchId, tenantId },
    select: { id: true },
  });
  if (!batch) throw new TariffRepoError("NOT_FOUND", "Import batch not found.");

  await prisma.tariffImportStagingRow.createMany({
    data: rows.map((r) => ({
      importBatchId,
      rowType: r.rowType,
      rawPayload: r.rawPayload,
      normalizedPayload: r.normalizedPayload ?? undefined,
      unresolvedFlags: r.unresolvedFlags ?? undefined,
    })),
  });
}

export async function deleteStagingRowsForBatch(tenantId: string, importBatchId: string) {
  const batch = await prisma.tariffImportBatch.findFirst({
    where: { id: importBatchId, tenantId },
    select: { id: true },
  });
  if (!batch) throw new TariffRepoError("NOT_FOUND", "Import batch not found.");
  await prisma.tariffImportStagingRow.deleteMany({ where: { importBatchId } });
}

export async function updateTariffImportStagingRow(
  tenantId: string,
  importBatchId: string,
  rowId: string,
  patch: Partial<{
    normalizedPayload: Prisma.InputJsonValue | null;
    unresolvedFlags: Prisma.InputJsonValue | null;
    approved: boolean;
    confidenceScore: number | null;
  }>,
) {
  const row = await prisma.tariffImportStagingRow.findFirst({
    where: { id: rowId, importBatchId, importBatch: { tenantId } },
    select: { id: true },
  });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Staging row not found for this batch.");
  const jsonOrNull = (v: Prisma.InputJsonValue | null | undefined) => {
    if (v === undefined) return undefined;
    if (v === null) return Prisma.DbNull;
    return v;
  };
  return prisma.tariffImportStagingRow.update({
    where: { id: rowId },
    data: {
      ...(patch.normalizedPayload !== undefined ? { normalizedPayload: jsonOrNull(patch.normalizedPayload) } : {}),
      ...(patch.unresolvedFlags !== undefined ? { unresolvedFlags: jsonOrNull(patch.unresolvedFlags) } : {}),
      ...(patch.approved !== undefined ? { approved: patch.approved } : {}),
      ...(patch.confidenceScore !== undefined ? { confidenceScore: patch.confidenceScore } : {}),
    },
  });
}
