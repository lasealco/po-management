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
  auditLogs: {
    id: string;
    actorUserId: string;
    action: string;
    note: string | null;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export type ApiHubIngestionRunAuditLogRow = {
  id: string;
  runId: string;
  actorUserId: string;
  action: string;
  note: string | null;
  createdAt: Date;
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
  auditLogs: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    select: {
      id: true,
      actorUserId: true,
      action: true,
      note: true,
      createdAt: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

const AUDIT_SELECT = {
  id: true,
  runId: true,
  actorUserId: true,
  action: true,
  note: true,
  createdAt: true,
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

  const created = await prisma.$transaction(async (tx) => {
    const run = await tx.apiHubIngestionRun.create({
      data: {
        tenantId: opts.tenantId,
        connectorId: opts.connectorId,
        requestedByUserId: opts.actorUserId,
        idempotencyKey: opts.idempotencyKey,
        status: "queued",
      },
      select: RUN_SELECT,
    });
    await tx.apiHubIngestionRunAuditLog.create({
      data: {
        tenantId: opts.tenantId,
        runId: run.id,
        actorUserId: opts.actorUserId,
        action: "run.queued",
        note: opts.idempotencyKey ? `Queued with idempotency key ${opts.idempotencyKey}.` : "Queued run.",
      },
    });
    return run;
  });
  return { run: created, idempotentReplay: false };
}

export async function transitionApiHubIngestionRun(opts: {
  tenantId: string;
  actorUserId: string;
  runId: string;
  nextStatus: ApiHubRunStatus;
  resultSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}): Promise<ApiHubIngestionRunRow | null> {
  const existing = await prisma.apiHubIngestionRun.findFirst({
    where: { tenantId: opts.tenantId, id: opts.runId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.apiHubIngestionRun.update({
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

    await tx.apiHubIngestionRunAuditLog.create({
      data: {
        tenantId: opts.tenantId,
        runId: existing.id,
        actorUserId: opts.actorUserId,
        action: "run.status.transitioned",
        note: `${existing.status} -> ${opts.nextStatus}${opts.errorCode ? ` (${opts.errorCode})` : ""}`,
      },
    });

    return updated;
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
      if (existing) {
        await tx.apiHubIngestionRunAuditLog.create({
          data: {
            tenantId: opts.tenantId,
            runId: existing.id,
            actorUserId: opts.actorUserId,
            action: "run.retry.replayed",
            note: "Retry idempotency key replayed existing run.",
          },
        });
        return existing;
      }
    }

    const retried = await tx.apiHubIngestionRun.create({
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

    await tx.apiHubIngestionRunAuditLog.create({
      data: {
        tenantId: opts.tenantId,
        runId: base.id,
        actorUserId: opts.actorUserId,
        action: "run.retry.requested",
        note: `Retry requested; created attempt ${base.attempt + 1}.`,
      },
    });
    await tx.apiHubIngestionRunAuditLog.create({
      data: {
        tenantId: opts.tenantId,
        runId: retried.id,
        actorUserId: opts.actorUserId,
        action: "run.queued",
        note: `Retry queued from run ${base.id}.`,
      },
    });

    return retried;
  });
}

export async function listApiHubIngestionRunAuditLogs(opts: {
  tenantId: string;
  runId: string;
  limit?: number;
}): Promise<ApiHubIngestionRunAuditLogRow[]> {
  return prisma.apiHubIngestionRunAuditLog.findMany({
    where: { tenantId: opts.tenantId, runId: opts.runId },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 20,
    select: AUDIT_SELECT,
  });
}

export async function applyApiHubIngestionRun(opts: {
  tenantId: string;
  runId: string;
  actorUserId: string;
  note: string | null;
}): Promise<{ run: ApiHubIngestionRunRow; applied: boolean; auditLog: ApiHubIngestionRunAuditLogRow | null } | null> {
  return prisma.$transaction(async (tx) => {
    const run = await tx.apiHubIngestionRun.findFirst({
      where: { tenantId: opts.tenantId, id: opts.runId },
      select: RUN_SELECT,
    });
    if (!run) {
      return null;
    }
    if (run.status !== "succeeded") {
      throw new Error("apply_requires_succeeded_status");
    }

    const existing = await tx.apiHubIngestionRunAuditLog.findFirst({
      where: {
        tenantId: opts.tenantId,
        runId: run.id,
        action: "run.apply.completed",
      },
      orderBy: { createdAt: "desc" },
      select: AUDIT_SELECT,
    });
    if (existing) {
      return { run, applied: false, auditLog: existing };
    }

    const createdAudit = await tx.apiHubIngestionRunAuditLog.create({
      data: {
        tenantId: opts.tenantId,
        runId: run.id,
        actorUserId: opts.actorUserId,
        action: "run.apply.completed",
        note: opts.note ?? "Applied ingestion run output to target write path.",
      },
      select: AUDIT_SELECT,
    });

    return { run, applied: true, auditLog: createdAudit };
  });
}
