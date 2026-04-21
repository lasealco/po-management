import { prisma } from "@/lib/prisma";

import { encodeIngestionRunListCursor } from "@/lib/apihub/ingestion-run-list-cursor";
import { apiHubIngestionMaxAttemptsForTrigger, type ApiHubIngestionTriggerKind } from "@/lib/apihub/constants";
import { allowedSourceStatusesForTransitionTo, ApiHubRunStatus } from "./run-lifecycle";

export type ApiHubIngestionRunRow = {
  id: string;
  connectorId: string | null;
  requestedByUserId: string;
  idempotencyKey: string | null;
  status: string;
  triggerKind: string;
  attempt: number;
  maxAttempts: number;
  resultSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  enqueuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  retryOfRunId: string | null;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const APIHUB_INGESTION_RUN_ROW_SELECT = {
  id: true,
  connectorId: true,
  requestedByUserId: true,
  idempotencyKey: true,
  status: true,
  triggerKind: true,
  attempt: true,
  maxAttempts: true,
  resultSummary: true,
  errorCode: true,
  errorMessage: true,
  enqueuedAt: true,
  startedAt: true,
  finishedAt: true,
  retryOfRunId: true,
  appliedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const RUN_SELECT = APIHUB_INGESTION_RUN_ROW_SELECT;

export type ListApiHubIngestionRunsResult = {
  items: ApiHubIngestionRunRow[];
  /** Opaque keyset cursor for the next page, or `null` when there is no next page. */
  nextCursor: string | null;
};

export async function listApiHubIngestionRuns(opts: {
  tenantId: string;
  status: string | null;
  limit: number;
  /** Keyset position (exclusive): rows older than this `(createdAt, id)` pair in `desc` order. */
  cursor?: { createdAt: Date; id: string } | null;
  connectorId?: string | null;
  triggerKind?: string | null;
  attemptRange?: { min: number; max: number } | null;
}): Promise<ListApiHubIngestionRunsResult> {
  const take = opts.limit + 1;
  const rows = await prisma.apiHubIngestionRun.findMany({
    where: {
      tenantId: opts.tenantId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.connectorId ? { connectorId: opts.connectorId } : {}),
      ...(opts.triggerKind ? { triggerKind: opts.triggerKind } : {}),
      ...(opts.attemptRange
        ? { attempt: { gte: opts.attemptRange.min, lte: opts.attemptRange.max } }
        : {}),
      ...(opts.cursor
        ? {
            OR: [
              { createdAt: { lt: opts.cursor.createdAt } },
              { AND: [{ createdAt: opts.cursor.createdAt }, { id: { lt: opts.cursor.id } }] },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: RUN_SELECT,
  });
  const hasMore = rows.length > opts.limit;
  const items = hasMore ? rows.slice(0, opts.limit) : rows;
  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const tail = items[items.length - 1]!;
    nextCursor = encodeIngestionRunListCursor(tail.createdAt, tail.id);
  }
  return { items, nextCursor };
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
  /** Defaults to `api` when omitted (HTTP create path). */
  triggerKind?: ApiHubIngestionTriggerKind;
}): Promise<{ run: ApiHubIngestionRunRow; idempotentReplay: boolean }> {
  const triggerKind = opts.triggerKind ?? "api";
  const maxAttempts = apiHubIngestionMaxAttemptsForTrigger(triggerKind);

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
      triggerKind,
      maxAttempts,
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
  const allowedFrom = allowedSourceStatusesForTransitionTo(opts.nextStatus);
  if (allowedFrom.length === 0) {
    throw new Error("run_invalid_transition_target");
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.apiHubIngestionRun.updateMany({
      where: {
        tenantId: opts.tenantId,
        id: opts.runId,
        status: { in: allowedFrom },
      },
      data: {
        status: opts.nextStatus,
        resultSummary: opts.resultSummary,
        errorCode: opts.errorCode,
        errorMessage: opts.errorMessage,
        ...(opts.nextStatus === "running" ? { startedAt: now, finishedAt: null } : {}),
        ...(opts.nextStatus === "succeeded" || opts.nextStatus === "failed" ? { finishedAt: now } : {}),
      },
    });

    if (updated.count === 0) {
      const exists = await tx.apiHubIngestionRun.findFirst({
        where: { tenantId: opts.tenantId, id: opts.runId },
        select: { id: true },
      });
      if (!exists) return null;
      throw new Error("run_transition_stale");
    }

    const row = await tx.apiHubIngestionRun.findFirst({
      where: { tenantId: opts.tenantId, id: opts.runId },
      select: RUN_SELECT,
    });
    if (!row) {
      throw new Error("run_transition_missing_row");
    }
    return row;
  });
}

export type RetryApiHubIngestionRunResult = {
  run: ApiHubIngestionRunRow;
  idempotentReplay: boolean;
};

export async function retryApiHubIngestionRun(opts: {
  tenantId: string;
  actorUserId: string;
  runId: string;
  idempotencyKey: string | null;
}): Promise<RetryApiHubIngestionRunResult | null> {
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
        const sameReplay =
          existing.retryOfRunId === base.id &&
          existing.attempt === base.attempt + 1 &&
          (existing.connectorId ?? null) === (base.connectorId ?? null);
        if (sameReplay) {
          return { run: existing, idempotentReplay: true };
        }
        throw new Error("retry_idempotency_key_conflict");
      }
    }

    const created = await tx.apiHubIngestionRun.create({
      data: {
        tenantId: opts.tenantId,
        connectorId: base.connectorId,
        requestedByUserId: opts.actorUserId,
        idempotencyKey: opts.idempotencyKey,
        status: "queued",
        triggerKind: "api",
        attempt: base.attempt + 1,
        maxAttempts: base.maxAttempts,
        retryOfRunId: base.id,
      },
      select: RUN_SELECT,
    });
    return { run: created, idempotentReplay: false };
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
