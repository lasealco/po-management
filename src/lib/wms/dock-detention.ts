/**
 * BF-54 — yard detention clocks from `WmsDockAppointment` milestones (gate → dock → depart).
 * Policy lives on `Tenant.wmsDockDetentionPolicyJson`; alerts are computed on-read (no cron in minimal slice).
 */

export type DockDetentionPolicy = {
  enabled: boolean;
  /** Max minutes from `gateCheckedInAt` to `atDockAt` before alert while still not at dock. */
  freeMinutesGateToDock: number;
  /** Max minutes from `atDockAt` to `departedAt` before alert while still at dock. */
  freeMinutesDockToDepart: number;
};

export type DockDetentionAlertPhase = "GATE_TO_DOCK" | "DOCK_DWELL";

export type DockDetentionAlert = {
  appointmentId: string;
  dockCode: string;
  warehouseId: string;
  phase: DockDetentionAlertPhase;
  /** Minutes beyond the free threshold (strictly positive). */
  minutesOver: number;
  limitMinutes: number;
  /** ISO — phase start (gate or dock). */
  phaseStartedAt: string;
};

const DEFAULT_FREE_GATE_TO_DOCK = 120;
const DEFAULT_FREE_DOCK_TO_DEPART = 240;

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  const t = Math.trunc(n);
  return Math.min(max, Math.max(min, t));
}

export function parseDockDetentionPolicy(raw: unknown): { ok: true; value: DockDetentionPolicy } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return {
      ok: true,
      value: {
        enabled: false,
        freeMinutesGateToDock: DEFAULT_FREE_GATE_TO_DOCK,
        freeMinutesDockToDepart: DEFAULT_FREE_DOCK_TO_DEPART,
      },
    };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Dock detention policy must be a JSON object." };
  }
  const o = raw as Record<string, unknown>;
  const enabled = o.enabled === true;
  let freeGate = DEFAULT_FREE_GATE_TO_DOCK;
  if (o.freeMinutesGateToDock !== undefined) {
    const g = Number(o.freeMinutesGateToDock);
    if (!Number.isFinite(g) || g < 1) {
      return { ok: false, error: "freeMinutesGateToDock must be a number ≥ 1 when set." };
    }
    freeGate = clampInt(g, 1, 24 * 60);
  }
  let freeDock = DEFAULT_FREE_DOCK_TO_DEPART;
  if (o.freeMinutesDockToDepart !== undefined) {
    const d = Number(o.freeMinutesDockToDepart);
    if (!Number.isFinite(d) || d < 1) {
      return { ok: false, error: "freeMinutesDockToDepart must be a number ≥ 1 when set." };
    }
    freeDock = clampInt(d, 1, 24 * 60);
  }
  return {
    ok: true,
    value: {
      enabled,
      freeMinutesGateToDock: freeGate,
      freeMinutesDockToDepart: freeDock,
    },
  };
}

export function policyForEval(policy: DockDetentionPolicy | null): DockDetentionPolicy | null {
  if (!policy || !policy.enabled) return null;
  return policy;
}

type ApptYardSlice = {
  id: string;
  warehouseId: string;
  dockCode: string;
  status: string;
  gateCheckedInAt: Date | null;
  atDockAt: Date | null;
  departedAt: Date | null;
};

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60000;
}

/** Live “stuck trailer” alerts for SCHEDULED appointments only. */
export function collectDockDetentionAlerts(
  appointments: ApptYardSlice[],
  policy: DockDetentionPolicy | null,
  now: Date,
): DockDetentionAlert[] {
  const p = policyForEval(policy);
  if (!p) return [];

  const out: DockDetentionAlert[] = [];
  for (const a of appointments) {
    if (a.status !== "SCHEDULED") continue;

    if (a.gateCheckedInAt && !a.atDockAt) {
      const elapsed = minutesBetween(a.gateCheckedInAt, now);
      const over = elapsed - p.freeMinutesGateToDock;
      if (over > 0) {
        out.push({
          appointmentId: a.id,
          dockCode: a.dockCode,
          warehouseId: a.warehouseId,
          phase: "GATE_TO_DOCK",
          minutesOver: Math.round(over * 10) / 10,
          limitMinutes: p.freeMinutesGateToDock,
          phaseStartedAt: a.gateCheckedInAt.toISOString(),
        });
      }
      continue;
    }

    if (a.atDockAt && !a.departedAt) {
      const elapsed = minutesBetween(a.atDockAt, now);
      const over = elapsed - p.freeMinutesDockToDepart;
      if (over > 0) {
        out.push({
          appointmentId: a.id,
          dockCode: a.dockCode,
          warehouseId: a.warehouseId,
          phase: "DOCK_DWELL",
          minutesOver: Math.round(over * 10) / 10,
          limitMinutes: p.freeMinutesDockToDepart,
          phaseStartedAt: a.atDockAt.toISOString(),
        });
      }
    }
  }
  return out;
}

/** After a yard milestone, detect if the segment that just closed exceeded policy (retrospective audit). */
export function detectMilestonePhaseBreach(params: {
  policy: DockDetentionPolicy | null;
  milestone: "GATE_IN" | "AT_DOCK" | "DEPARTED";
  occurredAt: Date;
  gateCheckedInAt: Date | null;
  atDockAt: Date | null;
}): { phase: DockDetentionAlertPhase; actualMinutes: number; limitMinutes: number } | null {
  const p = policyForEval(params.policy);
  if (!p) return null;

  if (params.milestone === "AT_DOCK" && params.gateCheckedInAt) {
    const actual = minutesBetween(params.gateCheckedInAt, params.occurredAt);
    if (actual > p.freeMinutesGateToDock) {
      return {
        phase: "GATE_TO_DOCK",
        actualMinutes: Math.round(actual * 10) / 10,
        limitMinutes: p.freeMinutesGateToDock,
      };
    }
  }

  if (params.milestone === "DEPARTED" && params.atDockAt) {
    const actual = minutesBetween(params.atDockAt, params.occurredAt);
    if (actual > p.freeMinutesDockToDepart) {
      return {
        phase: "DOCK_DWELL",
        actualMinutes: Math.round(actual * 10) / 10,
        limitMinutes: p.freeMinutesDockToDepart,
      };
    }
  }

  return null;
}
