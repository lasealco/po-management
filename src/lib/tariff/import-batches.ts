import type { Prisma, TariffSourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  TARIFF_IMPORT_PARSE_STATUS_SET,
  TARIFF_IMPORT_REVIEW_STATUS_SET,
} from "@/lib/tariff/import-batch-statuses";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export async function listTariffImportBatchesForTenant(params: { tenantId: string; take?: number }) {
  const take = Math.min(params.take ?? 100, 300);
  return prisma.tariffImportBatch.findMany({
    where: { tenantId: params.tenantId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: { legalEntity: { select: { id: true, name: true, code: true } } },
  });
}

export async function getTariffImportBatchForTenant(params: { tenantId: string; batchId: string }) {
  const row = await prisma.tariffImportBatch.findFirst({
    where: { id: params.batchId, tenantId: params.tenantId },
    include: {
      legalEntity: { select: { id: true, name: true, code: true } },
      stagingRows: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Import batch not found.");
  return row;
}

export async function createTariffImportBatch(input: {
  tenantId: string;
  legalEntityId?: string | null;
  sourceType: TariffSourceType;
  uploadedFilename?: string | null;
  sourceReference?: string | null;
  sourceFileUrl?: string | null;
  sourceMimeType?: string | null;
  sourceByteSize?: number | null;
  sourceMetadata?: Prisma.InputJsonValue | null;
  parseStatus?: string;
  reviewStatus?: string;
}) {
  const parseStatus = input.parseStatus ?? "UPLOADED";
  const reviewStatus = input.reviewStatus ?? "PENDING";
  if (!TARIFF_IMPORT_PARSE_STATUS_SET.has(parseStatus)) {
    throw new TariffRepoError("BAD_INPUT", `Invalid parseStatus "${parseStatus}".`);
  }
  if (!TARIFF_IMPORT_REVIEW_STATUS_SET.has(reviewStatus)) {
    throw new TariffRepoError("BAD_INPUT", `Invalid reviewStatus "${reviewStatus}".`);
  }
  return prisma.tariffImportBatch.create({
    data: {
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId ?? null,
      sourceType: input.sourceType,
      uploadedFilename: input.uploadedFilename?.trim() || null,
      sourceReference: input.sourceReference?.trim() || null,
      sourceFileUrl: input.sourceFileUrl?.trim() || null,
      sourceMimeType: input.sourceMimeType?.trim() || null,
      sourceByteSize: input.sourceByteSize ?? null,
      sourceMetadata: input.sourceMetadata ?? undefined,
      parseStatus,
      reviewStatus,
    },
  });
}

export async function updateTariffImportBatch(
  tenantId: string,
  batchId: string,
  patch: Partial<{
    parseStatus: string;
    reviewStatus: string;
    confidenceScore: number | null;
    sourceReference: string | null;
  }>,
) {
  const existing = await prisma.tariffImportBatch.findFirst({
    where: { id: batchId, tenantId },
    select: { id: true },
  });
  if (!existing) throw new TariffRepoError("NOT_FOUND", "Import batch not found.");
  if (patch.parseStatus != null && !TARIFF_IMPORT_PARSE_STATUS_SET.has(patch.parseStatus)) {
    throw new TariffRepoError("BAD_INPUT", `Invalid parseStatus "${patch.parseStatus}".`);
  }
  if (patch.reviewStatus != null && !TARIFF_IMPORT_REVIEW_STATUS_SET.has(patch.reviewStatus)) {
    throw new TariffRepoError("BAD_INPUT", `Invalid reviewStatus "${patch.reviewStatus}".`);
  }
  return prisma.tariffImportBatch.update({
    where: { id: batchId },
    data: {
      ...(patch.parseStatus != null ? { parseStatus: patch.parseStatus } : {}),
      ...(patch.reviewStatus != null ? { reviewStatus: patch.reviewStatus } : {}),
      ...(patch.confidenceScore !== undefined ? { confidenceScore: patch.confidenceScore } : {}),
      ...(patch.sourceReference !== undefined ? { sourceReference: patch.sourceReference } : {}),
    },
  });
}
