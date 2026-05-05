/**
 * BF-77 — tenant-configurable DONE-task labor variance (actual vs snapshotted `standardMinutes`).
 * Exceptions materialized on `GET /api/wms` read — no cron in minimal slice.
 */

import type { Prisma, PrismaClient, WmsTaskType } from "@prisma/client";

import type { WmsViewReadScope } from "@/lib/wms/wms-read-scope";

const ALLOWED_TASK_TYPES = new Set<WmsTaskType>([
  "PUTAWAY",
  "PICK",
  "REPLENISH",
  "CYCLE_COUNT",
  "VALUE_ADD",
  "KIT_BUILD",
]);

export const LABOR_VARIANCE_POLICY_SCHEMA_VERSION = "bf77.v1" as const;

export type LaborVariancePolicyBf77 = {
  schemaVersion: typeof LABOR_VARIANCE_POLICY_SCHEMA_VERSION;
  enabled: boolean;
  /** Flag tasks where actual minutes exceed standard × (1 + this percent / 100). Default 25. */
  excessPercentThreshold: number;
  /** Ignore very short completions (noise). Default 3. */
  minActualMinutes: number;
  /** Require at least this standard to evaluate (defaults avoid divide-by-zero). Default 1. */
  minStandardMinutes: number;
  /** DONE tasks completed after now − lookbackDays. Default 14. */
  lookbackDays: number;
  /** Cap exceptions returned. Default 40. */
  maxRows: number;
  /** Restrict to these task types, or null for all. */
  taskTypes: WmsTaskType[] | null;
};

export type ParsedLaborVariancePolicyBf77 = {
  policy: LaborVariancePolicyBf77;
  notice?: string;
};

const DEFAULT_POLICY: LaborVariancePolicyBf77 = {
  schemaVersion: LABOR_VARIANCE_POLICY_SCHEMA_VERSION,
  enabled: true,
  excessPercentThreshold: 25,
  minActualMinutes: 3,
  minStandardMinutes: 1,
  lookbackDays: 14,
  maxRows: 40,
  taskTypes: null,
};

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** Reads tenant JSON (or null) → resolved policy + optional parse notice (invalid shape → defaults). */
export function parseLaborVariancePolicyBf77Json(raw: unknown): ParsedLaborVariancePolicyBf77 {
  let notice: string | undefined;
  let src: Record<string, unknown> = {};
  if (raw == null) {
    return { policy: { ...DEFAULT_POLICY, enabled: false } };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    notice = "Stored policy JSON was not an object — defaults applied.";
    return { policy: { ...DEFAULT_POLICY, enabled: false }, notice };
  }
  src = raw as Record<string, unknown>;

  const enabled = typeof src.enabled === "boolean" ? src.enabled : DEFAULT_POLICY.enabled;

  let excessPercentThreshold = DEFAULT_POLICY.excessPercentThreshold;
  if (typeof src.excessPercentThreshold === "number" && Number.isFinite(src.excessPercentThreshold)) {
    excessPercentThreshold = clampInt(src.excessPercentThreshold, 0, 500);
  } else if (typeof src.excessPercentThreshold === "string" && src.excessPercentThreshold.trim()) {
    const n = Number(src.excessPercentThreshold);
    if (Number.isFinite(n)) excessPercentThreshold = clampInt(n, 0, 500);
  }

  let minActualMinutes = DEFAULT_POLICY.minActualMinutes;
  if (typeof src.minActualMinutes === "number" && Number.isFinite(src.minActualMinutes)) {
    minActualMinutes = clampInt(src.minActualMinutes, 0, 180);
  }

  let minStandardMinutes = DEFAULT_POLICY.minStandardMinutes;
  if (typeof src.minStandardMinutes === "number" && Number.isFinite(src.minStandardMinutes)) {
    minStandardMinutes = clampInt(src.minStandardMinutes, 1, 10080);
  }

  let lookbackDays = DEFAULT_POLICY.lookbackDays;
  if (typeof src.lookbackDays === "number" && Number.isFinite(src.lookbackDays)) {
    lookbackDays = clampInt(src.lookbackDays, 1, 90);
  }

  let maxRows = DEFAULT_POLICY.maxRows;
  if (typeof src.maxRows === "number" && Number.isFinite(src.maxRows)) {
    maxRows = clampInt(src.maxRows, 5, 200);
  }

  let taskTypes: WmsTaskType[] | null = DEFAULT_POLICY.taskTypes;
  if (Array.isArray(src.taskTypes)) {
    const cleaned = src.taskTypes
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((t) => t.trim())
      .filter((t): t is WmsTaskType => ALLOWED_TASK_TYPES.has(t as WmsTaskType));
    taskTypes = cleaned.length > 0 ? cleaned : null;
  }

  return {
    policy: {
      schemaVersion: LABOR_VARIANCE_POLICY_SCHEMA_VERSION,
      enabled,
      excessPercentThreshold,
      minActualMinutes,
      minStandardMinutes,
      lookbackDays,
      maxRows,
      taskTypes,
    },
    notice,
  };
}

export function isLaborVarianceExceeded(
  actualMinutes: number,
  standardMinutes: number,
  policy: LaborVariancePolicyBf77,
): boolean {
  if (!policy.enabled) return false;
  if (standardMinutes < policy.minStandardMinutes) return false;
  if (actualMinutes < policy.minActualMinutes) return false;
  const ceiling = standardMinutes * (1 + policy.excessPercentThreshold / 100);
  return actualMinutes > ceiling;
}

export type LaborVarianceExceptionBf77 = {
  taskId: string;
  taskType: string;
  warehouseCode: string | null;
  warehouseName: string;
  actualMinutes: number;
  standardMinutes: number;
  excessMinutes: number;
  variancePctVsStandard: number;
  completedAt: string;
  completedBy: { id: string; name: string | null } | null;
};

/** Validates POST draft fields before persisting to `Tenant.wmsLaborVariancePolicyJson`. */
export function validateLaborVariancePolicyDraftFromPost(input: {
  enabled: boolean;
  excessPercentThreshold?: number;
  minActualMinutes?: number;
  minStandardMinutes?: number;
  lookbackDays?: number;
  maxRows?: number;
  taskTypes?: unknown;
}): { ok: true; policy: LaborVariancePolicyBf77 } | { ok: false; error: string } {
  if (input.taskTypes !== undefined && input.taskTypes !== null && !Array.isArray(input.taskTypes)) {
    return { ok: false, error: "taskTypes must be an array of strings or omitted." };
  }
  const draft: Record<string, unknown> = {
    enabled: input.enabled,
    ...(input.excessPercentThreshold !== undefined ? { excessPercentThreshold: input.excessPercentThreshold } : {}),
    ...(input.minActualMinutes !== undefined ? { minActualMinutes: input.minActualMinutes } : {}),
    ...(input.minStandardMinutes !== undefined ? { minStandardMinutes: input.minStandardMinutes } : {}),
    ...(input.lookbackDays !== undefined ? { lookbackDays: input.lookbackDays } : {}),
    ...(input.maxRows !== undefined ? { maxRows: input.maxRows } : {}),
    ...(input.taskTypes !== undefined ? { taskTypes: input.taskTypes } : {}),
  };
  const { policy } = parseLaborVariancePolicyBf77Json(draft);
  const { excessPercentThreshold, minActualMinutes, minStandardMinutes, lookbackDays, maxRows } = policy;
  if (!Number.isFinite(excessPercentThreshold) || excessPercentThreshold < 0 || excessPercentThreshold > 500) {
    return { ok: false, error: "excessPercentThreshold must be between 0 and 500." };
  }
  if (!Number.isFinite(minActualMinutes) || minActualMinutes < 0 || minActualMinutes > 180) {
    return { ok: false, error: "minActualMinutes must be between 0 and 180." };
  }
  if (!Number.isFinite(minStandardMinutes) || minStandardMinutes < 1 || minStandardMinutes > 10080) {
    return { ok: false, error: "minStandardMinutes must be between 1 and 10080." };
  }
  if (!Number.isFinite(lookbackDays) || lookbackDays < 1 || lookbackDays > 90) {
    return { ok: false, error: "lookbackDays must be between 1 and 90." };
  }
  if (!Number.isFinite(maxRows) || maxRows < 5 || maxRows > 200) {
    return { ok: false, error: "maxRows must be between 5 and 200." };
  }
  return { ok: true, policy };
}

/** Canonical JSON stored on tenant (no schemaVersion). */
export function laborVariancePolicyToStoredJson(policy: LaborVariancePolicyBf77): Prisma.InputJsonValue {
  return {
    enabled: policy.enabled,
    excessPercentThreshold: policy.excessPercentThreshold,
    minActualMinutes: policy.minActualMinutes,
    minStandardMinutes: policy.minStandardMinutes,
    lookbackDays: policy.lookbackDays,
    maxRows: policy.maxRows,
    taskTypes: policy.taskTypes ?? [],
  };
}

export async function loadLaborVarianceExceptionsBf77(
  prisma: PrismaClient,
  tenantId: string,
  policy: LaborVariancePolicyBf77,
  taskScope: Prisma.WmsTaskWhereInput,
): Promise<LaborVarianceExceptionBf77[]> {
  if (!policy.enabled) return [];

  const cutoff = new Date(Date.now() - policy.lookbackDays * 86_400_000);
  const typeWhere: Prisma.WmsTaskWhereInput =
    policy.taskTypes && policy.taskTypes.length > 0 ? { taskType: { in: policy.taskTypes } } : {};

  const scanTake = Math.min(500, Math.max(policy.maxRows * 15, policy.maxRows));

  const rows = await prisma.wmsTask.findMany({
    where: {
      AND: [
        {
          tenantId,
          status: "DONE",
          startedAt: { not: null },
          completedAt: { not: null, gte: cutoff },
          standardMinutes: { not: null },
        },
        taskScope,
        typeWhere,
      ],
    },
    orderBy: { completedAt: "desc" },
    take: scanTake,
    select: {
      id: true,
      taskType: true,
      standardMinutes: true,
      startedAt: true,
      completedAt: true,
      warehouse: { select: { code: true, name: true } },
      completedBy: { select: { id: true, name: true } },
    },
  });

  const out: LaborVarianceExceptionBf77[] = [];
  for (const r of rows) {
    if (r.standardMinutes == null || !r.startedAt || !r.completedAt) continue;
    const actualMinutes = (r.completedAt.getTime() - r.startedAt.getTime()) / 60_000;
    if (!Number.isFinite(actualMinutes)) continue;
    if (!isLaborVarianceExceeded(actualMinutes, r.standardMinutes, policy)) continue;

    const excessMinutes = actualMinutes - r.standardMinutes;
    const variancePctVsStandard =
      r.standardMinutes > 0 ? ((actualMinutes - r.standardMinutes) / r.standardMinutes) * 100 : 0;

    out.push({
      taskId: r.id,
      taskType: r.taskType,
      warehouseCode: r.warehouse.code ?? null,
      warehouseName: r.warehouse.name,
      actualMinutes: Math.round(actualMinutes * 1000) / 1000,
      standardMinutes: r.standardMinutes,
      excessMinutes: Math.round(excessMinutes * 1000) / 1000,
      variancePctVsStandard: Math.round(variancePctVsStandard * 10) / 10,
      completedAt: r.completedAt.toISOString(),
      completedBy: r.completedBy ? { id: r.completedBy.id, name: r.completedBy.name } : null,
    });

    if (out.length >= policy.maxRows) break;
  }

  return out;
}
