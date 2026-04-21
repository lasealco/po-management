import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ApiHubApplyIdempotencyRow = {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  ingestionRunId: string;
  dryRun: boolean;
  responseStatus: number;
  responseBody: Prisma.JsonValue;
  createdAt: Date;
};

function isPrismaUniqueViolation(caught: unknown): boolean {
  return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002";
}

export async function findApplyIdempotencyRecord(opts: {
  tenantId: string;
  idempotencyKey: string;
}): Promise<ApiHubApplyIdempotencyRow | null> {
  return prisma.apiHubIngestionApplyIdempotency.findUnique({
    where: {
      tenantId_idempotencyKey: {
        tenantId: opts.tenantId,
        idempotencyKey: opts.idempotencyKey,
      },
    },
  });
}

/**
 * Persists the first successful apply response for a tenant-scoped idempotency key.
 * On unique violation (concurrent duplicate), returns the existing row so the caller can replay it.
 */
export async function createApplyIdempotencyRecord(opts: {
  tenantId: string;
  idempotencyKey: string;
  runId: string;
  dryRun: boolean;
  responseStatus: number;
  responseBody: Prisma.InputJsonValue;
}): Promise<{ created: true } | { created: false; existing: ApiHubApplyIdempotencyRow }> {
  try {
    await prisma.apiHubIngestionApplyIdempotency.create({
      data: {
        tenantId: opts.tenantId,
        idempotencyKey: opts.idempotencyKey,
        ingestionRunId: opts.runId,
        dryRun: opts.dryRun,
        responseStatus: opts.responseStatus,
        responseBody: opts.responseBody,
      },
    });
    return { created: true };
  } catch (caught) {
    if (!isPrismaUniqueViolation(caught)) {
      throw caught;
    }
    const existing = await findApplyIdempotencyRecord({
      tenantId: opts.tenantId,
      idempotencyKey: opts.idempotencyKey,
    });
    if (!existing) {
      throw caught;
    }
    return { created: false, existing };
  }
}
