/**
 * BF-96 — deterministic dock SLA breach risk scores from yard milestones + BF-54 thresholds.
 *
 * Exposed on `GET /api/wms` as `dockSlaRiskScores` when tenant BF-93 flag
 * `dockSlaRiskScorerBf96` is true (see `isDockSlaRiskScorerBf96Enabled`).
 *
 * Scoring is ordinal (0–100), no ML:
 * - **PRE_GATE:** window progress and slack before `gateCheckedInAt`.
 * - **GATE_TO_DOCK / DOCK_DWELL:** elapsed vs `freeMinutesGateToDock` / `freeMinutesDockToDepart`
 *   with staged ramps; **detentionBreached** mirrors BF-54 live alerts when policy is enabled.
 */

import type { DockDetentionPolicy } from "@/lib/wms/dock-detention";
import type { WmsFeatureFlagsBf93PayloadView } from "@/lib/wms/wms-feature-flags-bf93";

export const DOCK_SLA_RISK_SCORER_BF96_FLAG = "dockSlaRiskScorerBf96" as const;

export type DockSlaRiskBf96Phase = "PRE_GATE" | "GATE_TO_DOCK" | "DOCK_DWELL";

export type DockSlaRiskAppointmentSliceBf96 = {
  id: string;
  warehouseId: string;
  dockCode: string;
  status: string;
  windowStart: Date;
  windowEnd: Date;
  gateCheckedInAt: Date | null;
  atDockAt: Date | null;
  departedAt: Date | null;
};

export type DockSlaRiskScoreBf96 = {
  appointmentId: string;
  dockCode: string;
  warehouseId: string;
  phase: DockSlaRiskBf96Phase;
  /** 0–100 inclusive. */
  riskScore: number;
  /** BF-54 segment elapsed minutes; null in PRE_GATE. */
  minutesConsumed: number | null;
  /** BF-54 free threshold for the active yard segment; null in PRE_GATE. */
  limitMinutes: number | null;
  /**
   * PRE_GATE: whole minutes until `windowEnd` (negative after window end).
   * GATE_TO_DOCK / DOCK_DWELL: remaining budget before BF-54 breach (negative if over).
   */
  minutesRemaining: number | null;
  windowEndsAt: string;
  /** Deterministic reason tokens (sorted). */
  factors: string[];
  /** Same condition as BF-54 `collectDockDetentionAlerts` for this appointment when policy.enabled. */
  detentionBreached: boolean;
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60000;
}

function floorMinutes(a: Date, b: Date): number {
  return Math.floor(minutesBetween(a, b));
}

function sortDedupeFactors(factors: string[]): string[] {
  return [...new Set(factors)].sort((x, y) => x.localeCompare(y));
}

/** Segment utilization vs BF-54 free minutes (GATE_TO_DOCK / DOCK_DWELL). */
function segmentUtilizationRisk(elapsedMin: number, limitMin: number): { score: number; factors: string[] } {
  const limit = Math.max(1, limitMin);
  const u = elapsedMin / limit;
  const factors: string[] = [];
  if (u >= 1) {
    factors.push("BF54_SEGMENT_BREACH");
    const over = elapsedMin - limit;
    return { score: 70 + Math.min(30, Math.round((over / limit) * 30)), factors };
  }
  if (u >= 0.9) {
    factors.push("BF54_SEGMENT_NEAR_BREACH");
    return { score: 55 + Math.round(((u - 0.9) / 0.1) * 15), factors };
  }
  if (u >= 0.75) {
    factors.push("BF54_SEGMENT_PRESSURE");
    return { score: 35 + Math.round(((u - 0.75) / 0.15) * 20), factors };
  }
  factors.push("BF54_SEGMENT_ON_TRACK");
  return { score: Math.round((u / 0.75) * 35), factors };
}

function preGateWindowRisk(now: Date, windowStart: Date, windowEnd: Date): { score: number; factors: string[] } {
  const factors: string[] = [];
  if (now.getTime() < windowStart.getTime()) {
    factors.push("PRE_GATE_BEFORE_WINDOW");
    const minsUntilStart = floorMinutes(now, windowStart);
    const proximity = Math.min(12, Math.floor(minsUntilStart / 45));
    return { score: clampScore(12 - proximity), factors };
  }
  if (now.getTime() <= windowEnd.getTime()) {
    factors.push("PRE_GATE_IN_WINDOW_NO_GATE_IN");
    const winDur = Math.max(1, floorMinutes(windowStart, windowEnd));
    const elapsedInWin = Math.max(0, floorMinutes(windowStart, now));
    const progress = elapsedInWin / winDur;
    let score = 18 + Math.round(progress * 42);
    const minsToEnd = floorMinutes(now, windowEnd);
    if (minsToEnd < 45) {
      factors.push("PRE_GATE_WINDOW_CLOSING");
      score += Math.round(((45 - minsToEnd) / 45) * 28);
    }
    return { score: clampScore(score), factors };
  }
  factors.push("PRE_GATE_WINDOW_ENDED_NO_GATE_IN");
  const pastEnd = floorMinutes(windowEnd, now);
  return { score: clampScore(72 + Math.min(28, Math.round((pastEnd / 120) * 28))), factors };
}

function windowOverrunBoost(now: Date, windowEnd: Date, atDockAt: Date | null): { add: number; factor?: string } {
  if (atDockAt) return { add: 0 };
  if (now.getTime() <= windowEnd.getTime()) return { add: 0 };
  const pastEnd = floorMinutes(windowEnd, now);
  return {
    add: Math.min(25, Math.round(pastEnd / 6)),
    factor: "WINDOW_END_PASSED_NOT_AT_DOCK",
  };
}

export function isDockSlaRiskScorerBf96Enabled(view: WmsFeatureFlagsBf93PayloadView | null): boolean {
  if (!view || view.parseError) return false;
  return view.flags[DOCK_SLA_RISK_SCORER_BF96_FLAG] === true;
}

export function buildDockSlaRiskScoresBf96(
  appointments: DockSlaRiskAppointmentSliceBf96[],
  policy: DockDetentionPolicy,
  now: Date,
): DockSlaRiskScoreBf96[] {
  const rows: DockSlaRiskScoreBf96[] = [];

  for (const a of appointments) {
    if (a.status !== "SCHEDULED") continue;
    if (a.departedAt) continue;

    const windowEndsAt = a.windowEnd.toISOString();
    let phase: DockSlaRiskBf96Phase;
    let riskScore: number;
    let minutesConsumed: number | null = null;
    let limitMinutes: number | null = null;
    let minutesRemaining: number | null = null;
    let factors: string[] = [];
    let detentionBreached = false;

    if (!a.gateCheckedInAt) {
      phase = "PRE_GATE";
      const pre = preGateWindowRisk(now, a.windowStart, a.windowEnd);
      riskScore = pre.score;
      factors = pre.factors;
      minutesRemaining = floorMinutes(now, a.windowEnd);
    } else if (!a.atDockAt) {
      phase = "GATE_TO_DOCK";
      const elapsed = minutesBetween(a.gateCheckedInAt, now);
      minutesConsumed = Math.round(elapsed * 10) / 10;
      limitMinutes = policy.freeMinutesGateToDock;
      minutesRemaining = Math.round((policy.freeMinutesGateToDock - elapsed) * 10) / 10;
      const seg = segmentUtilizationRisk(elapsed, policy.freeMinutesGateToDock);
      riskScore = seg.score;
      factors = [...seg.factors];
      const boost = windowOverrunBoost(now, a.windowEnd, a.atDockAt);
      if (boost.factor) factors.push(boost.factor);
      riskScore = clampScore(riskScore + boost.add);
      if (policy.enabled && elapsed > policy.freeMinutesGateToDock) detentionBreached = true;
    } else {
      phase = "DOCK_DWELL";
      const elapsed = minutesBetween(a.atDockAt, now);
      minutesConsumed = Math.round(elapsed * 10) / 10;
      limitMinutes = policy.freeMinutesDockToDepart;
      minutesRemaining = Math.round((policy.freeMinutesDockToDepart - elapsed) * 10) / 10;
      const seg = segmentUtilizationRisk(elapsed, policy.freeMinutesDockToDepart);
      riskScore = clampScore(seg.score);
      factors = [...seg.factors];
      if (policy.enabled && elapsed > policy.freeMinutesDockToDepart) detentionBreached = true;
    }

    if (detentionBreached) factors.push("DETENTION_POLICY_BREACH");

    rows.push({
      appointmentId: a.id,
      dockCode: a.dockCode,
      warehouseId: a.warehouseId,
      phase,
      riskScore: clampScore(riskScore),
      minutesConsumed,
      limitMinutes,
      minutesRemaining,
      windowEndsAt,
      factors: sortDedupeFactors(factors),
      detentionBreached,
    });
  }

  rows.sort((x, y) => {
    if (y.riskScore !== x.riskScore) return y.riskScore - x.riskScore;
    return x.appointmentId.localeCompare(y.appointmentId);
  });

  return rows;
}
