import type { Prisma, WmsTaskType } from "@prisma/client";

export type LaborTimingInputRow = {
  startedAt: Date;
  completedAt: Date;
  standardMinutes: number | null;
};

export type LaborTimingSummary = {
  sampleCount: number;
  avgActualMinutes: number | null;
  avgStandardMinutes: number | null;
  /** Standard ÷ actual × 100 when both averages exist and actual > 0; >100 means faster than standard. */
  efficiencyVsStandardPercent: number | null;
};

/** Fetch engineered standard minutes for a task type (used at task creation). */
export async function laborStandardMinutesSnapshot(
  db: Pick<Prisma.TransactionClient, "wmsLaborTaskStandard">,
  tenantId: string,
  taskType: WmsTaskType,
): Promise<number | null> {
  const row = await db.wmsLaborTaskStandard.findUnique({
    where: { tenantId_taskType: { tenantId, taskType } },
    select: { standardMinutes: true },
  });
  return row?.standardMinutes ?? null;
}

export function buildLaborTimingSummary(rows: LaborTimingInputRow[]): LaborTimingSummary {
  if (rows.length === 0) {
    return {
      sampleCount: 0,
      avgActualMinutes: null,
      avgStandardMinutes: null,
      efficiencyVsStandardPercent: null,
    };
  }
  let actualSum = 0;
  let stdSum = 0;
  let stdN = 0;
  for (const r of rows) {
    const mins = (r.completedAt.getTime() - r.startedAt.getTime()) / 60_000;
    actualSum += mins;
    if (r.standardMinutes != null) {
      stdSum += r.standardMinutes;
      stdN += 1;
    }
  }
  const avgActual = Math.round((1000 * actualSum) / rows.length) / 1000;
  const avgStd = stdN > 0 ? Math.round((1000 * stdSum) / stdN) / 1000 : null;
  const efficiencyVsStandardPercent =
    avgStd != null && avgActual > 0 ? Math.round((10000 * avgStd) / avgActual) / 100 : null;
  return {
    sampleCount: rows.length,
    avgActualMinutes: avgActual,
    avgStandardMinutes: avgStd,
    efficiencyVsStandardPercent,
  };
}
