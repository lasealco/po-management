import { prisma } from "@/lib/prisma";

import { ApiHubRunStatus } from "./run-lifecycle";

export type ApiHubIngestionRunRow = {
  id: string;
  connectorId: string | null;
  requestedByUserId: string;
  idempotencyKey: string | null;
  status: string;
  attempt: number;
  maxAttempts: number;
  resultSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  enqueuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  retryOfRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const RUN_SELECT = {
  id: true,
  connectorId: true,
  requestedByUserId: true,
  idempotencyKey: true,
  status: true,
  attempt: true,
  maxAttempts: true,
  resultSummary: true,
  errorCode: true,
  errorMessage: true,
  enqueuedAt: true,
  startedAt: true,
  finishedAt: true,
  retryOfRunId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listApiHubIngestionRuns(opts: {
  tenantId: string;
  status: string | null;
  limit: number;
}): Promise<ApiHubIngestionRunRow[]> {
  return prisma.apiHubIngestionRun.findMany({
    where: { tenantId: opts.tenantId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.limit,
    select: RUN_SELECT,
  });
}

export async function getApiHubIngestionRunById(opts: {
  tenantId: string;
  runId: string;
}): Promise<ApiHubIngestionRunRow | null> {
  return prisma.apiHubIngestionRun.findFirst({
    where: { tenantId: opts.tenantId, id: opts.runId },
    select: RUN_SELECT,
  });
}

export async function createApiHubIngestionRun(opts: {
  tenantId: string;
  actorUserId: string;
  connectorId: string | null;
  idempotencyKey: string | null;
}): Promise<{ run: ApiHubIngestionRunRow; idempotentReplay: boolean }> {
  if (opts.connectorId) {
    const connector = await prisma.apiHubConnector.findFirst({
      where: { id: opts.connectorId, tenantId: opts.tenantId },
      select: { id: true },
    });
    if (!connector) {
      throw new Error("connector_not_found");
    }
  }

  if (opts.idempotencyKey) {
    const existing = await prisma.apiHubIngestionRun.findFirst({
      where: { tenantId: opts.tenantId, idempotencyKey: opts.idempotencyKey },
      select: RUN_SELECT,
    });
    if (existing) {
      return { run: existing, idempotentReplay: true };
    }
  }

  const created = await prisma.apiHubIngestionRun.create({
    data: {
      tenantId: opts.tenantId,
      connectorId: opts.connectorId,
      requestedByUserId: opts.actorUserId,
      idempotencyKey: opts.idempotencyKey,
      status: "queued",
    },
    select: RUN_SELECT,
  });
  return { run: created, idempotentReplay: false };
}

export async function transitionApiHubIngestionRun(opts: {
  tenantId: string;
  runId: string;
  nextStatus: ApiHubRunStatus;
  resultSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}): Promise<ApiHubIngestionRunRow | null> {
  const existing = await prisma.apiHubIngestionRun.findFirst({
    where: { tenantId: opts.tenantId, id: opts.runId },
    select: { id: true },
  });
  if (!existing) return null;

  const now = new Date();
  return prisma.apiHubIngestionRun.update({
    where: { id: existing.id },
    data: {
      status: opts.nextStatus,
      resultSummary: opts.resultSummary,
      errorCode: opts.errorCode,
      errorMessage: opts.errorMessage,
      ...(opts.nextStatus === "running" ? { startedAt: now, finishedAt: null } : {}),
      ...(opts.nextStatus === "succeeded" || opts.nextStatus === "failed" ? { finishedAt: now } : {}),
    },
    select: RUN_SELECT,
  });
}

export async function retryApiHubIngestionRun(opts: {
  tenantId: string;
  actorUserId: string;
  runId: string;
  idempotencyKey: string | null;
}): Promise<ApiHubIngestionRunRow | null> {
  return prisma.$transaction(async (tx) => {
    const base = await tx.apiHubIngestionRun.findFirst({
      where: { tenantId: opts.tenantId, id: opts.runId },
      select: {
        id: true,
        connectorId: true,
        status: true,
        attempt: true,
        maxAttempts: true,
      },
    });
    if (!base) return null;
    if (base.status !== "failed") {
      throw new Error("retry_requires_failed_status");
    }
    if (base.attempt >= base.maxAttempts) {
      throw new Error("retry_limit_reached");
    }

    if (opts.idempotencyKey) {
      const existing = await tx.apiHubIngestionRun.findFirst({
        where: { tenantId: opts.tenantId, idempotencyKey: opts.idempotencyKey },
        select: RUN_SELECT,
      });
      if (existing) return existing;
    }

    return tx.apiHubIngestionRun.create({
      data: {
        tenantId: opts.tenantId,
        connectorId: base.connectorId,
        requestedByUserId: opts.actorUserId,
        idempotencyKey: opts.idempotencyKey,
        status: "queued",
        attempt: base.attempt + 1,
        maxAttempts: base.maxAttempts,
        retryOfRunId: base.id,
      },
      select: RUN_SELECT,
    });
  });
}

export async function countInFlightApiHubIngestionRunsForConnector(opts: {
  tenantId: string;
  connectorId: string;
}): Promise<number> {
  return prisma.apiHubIngestionRun.count({
    where: {
      tenantId: opts.tenantId,
      connectorId: opts.connectorId,
      status: { in: ["queued", "running"] },
    },
  });
}
