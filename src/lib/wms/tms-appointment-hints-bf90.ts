/**
 * BF-90 — advisory TMS dock-window hints from yard queue shape + BF-54 detention timers.
 * Read-only export; no carrier/TMS write-back.
 */

import type { PrismaClient } from "@prisma/client";

import {
  collectDockDetentionAlerts,
  parseDockDetentionPolicy,
  policyForEval,
  type DockDetentionPolicy,
} from "@/lib/wms/dock-detention";

export const BF90_SCHEMA_VERSION = "bf90.v1" as const;

/** Minutes-to-threshold window used for informational “pressure” hints (not breaches). */
export const BF90_DETENTION_PRESSURE_LEAD_MINUTES = 15;

export type Bf90DetentionPolicySummary = {
  enabled: boolean;
  freeMinutesGateToDock: number;
  freeMinutesDockToDepart: number;
  /** When tenant JSON is invalid, detention alerts are suppressed. */
  policyParseError?: string;
};

export type Bf90DockQueueSlot = {
  appointmentId: string;
  windowStart: string;
  windowEnd: string;
  direction: string;
  status: string;
  /** Zero-based position after sorting by windowStart among SCHEDULED rows on this dock. */
  queueIndex: number;
  /** Other SCHEDULED appointments on this dock whose windows overlap this one. */
  overlappingScheduledPeerCount: number;
  tmsLoadId: string | null;
  tmsCarrierBookingRef: string | null;
  gateCheckedInAt: string | null;
  atDockAt: string | null;
  departedAt: string | null;
  detentionBreach: {
    phase: string;
    minutesOver: number;
    limitMinutes: number;
  } | null;
  detentionPressure: {
    phase: string;
    minutesRemaining: number;
  } | null;
};

export type Bf90DockQueueSummary = {
  warehouseId: string;
  dockCode: string;
  scheduledCount: number;
  slots: Bf90DockQueueSlot[];
};

export type Bf90HintSeverity = "INFO" | "WARN";

export type Bf90AdvisoryHintKind =
  | "OVERLAPPING_WINDOWS"
  | "QUEUE_DEPTH"
  | "DETENTION_BREACH"
  | "DETENTION_PRESSURE";

export type Bf90AdvisoryHint = {
  severity: Bf90HintSeverity;
  kind: Bf90AdvisoryHintKind;
  appointmentId: string;
  warehouseId: string;
  dockCode: string;
  message: string;
  context: Record<string, string | number | boolean | null>;
};

export type Bf90Doc = {
  schemaVersion: typeof BF90_SCHEMA_VERSION;
  generatedAt: string;
  advisoryOnly: true;
  /** BF-54 yard detention thresholds reflected in this evaluation (may be disabled). */
  detentionPolicySummary: Bf90DetentionPolicySummary;
  /** When set, appointments were filtered to this warehouse. */
  warehouseId: string | null;
  dockQueues: Bf90DockQueueSummary[];
  hints: Bf90AdvisoryHint[];
};

export type Bf90AppointmentInput = {
  id: string;
  warehouseId: string;
  dockCode: string;
  windowStart: Date;
  windowEnd: Date;
  direction: string;
  status: string;
  tmsLoadId: string | null;
  tmsCarrierBookingRef: string | null;
  gateCheckedInAt: Date | null;
  atDockAt: Date | null;
  departedAt: Date | null;
};

export function intervalsOverlapInclusive(aStartMs: number, aEndMs: number, bStartMs: number, bEndMs: number): boolean {
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

function computeDetentionPressure(
  a: Bf90AppointmentInput,
  policy: DockDetentionPolicy | null,
  now: Date,
  leadMinutes: number,
): { phase: "GATE_TO_DOCK" | "DOCK_DWELL"; minutesRemaining: number } | null {
  const p = policyForEval(policy);
  if (!p || a.status !== "SCHEDULED") return null;

  if (a.gateCheckedInAt && !a.atDockAt) {
    const elapsed = (now.getTime() - a.gateCheckedInAt.getTime()) / 60000;
    const remaining = p.freeMinutesGateToDock - elapsed;
    if (remaining > 0 && remaining <= leadMinutes) {
      return { phase: "GATE_TO_DOCK", minutesRemaining: Math.round(remaining * 10) / 10 };
    }
    return null;
  }

  if (a.atDockAt && !a.departedAt) {
    const elapsed = (now.getTime() - a.atDockAt.getTime()) / 60000;
    const remaining = p.freeMinutesDockToDepart - elapsed;
    if (remaining > 0 && remaining <= leadMinutes) {
      return { phase: "DOCK_DWELL", minutesRemaining: Math.round(remaining * 10) / 10 };
    }
  }

  return null;
}

export function buildTmsAppointmentHintsBf90Doc(params: {
  now: Date;
  warehouseIdFilter: string | null;
  detentionPolicyJson: unknown;
  appointments: Bf90AppointmentInput[];
}): Bf90Doc {
  const detentionParsed = parseDockDetentionPolicy(params.detentionPolicyJson);
  const policyModel: DockDetentionPolicy = detentionParsed.ok
    ? detentionParsed.value
    : {
        enabled: false,
        freeMinutesGateToDock: 120,
        freeMinutesDockToDepart: 240,
      };

  const detentionPolicySummary: Bf90DetentionPolicySummary = detentionParsed.ok
    ? {
        enabled: policyModel.enabled,
        freeMinutesGateToDock: policyModel.freeMinutesGateToDock,
        freeMinutesDockToDepart: policyModel.freeMinutesDockToDepart,
      }
    : {
        enabled: false,
        freeMinutesGateToDock: 120,
        freeMinutesDockToDepart: 240,
        policyParseError: detentionParsed.error,
      };

  let rows = params.appointments;
  if (params.warehouseIdFilter) {
    rows = rows.filter((r) => r.warehouseId === params.warehouseIdFilter);
  }

  const yardSlices = rows.map((a) => ({
    id: a.id,
    warehouseId: a.warehouseId,
    dockCode: a.dockCode,
    status: a.status,
    gateCheckedInAt: a.gateCheckedInAt,
    atDockAt: a.atDockAt,
    departedAt: a.departedAt,
  }));

  const alerts = collectDockDetentionAlerts(yardSlices, policyModel, params.now);
  const alertByApptId = new Map(alerts.map((x) => [x.appointmentId, x]));

  const scheduled = rows.filter((r) => r.status === "SCHEDULED");
  const groups = new Map<string, Bf90AppointmentInput[]>();
  for (const r of scheduled) {
    const k = `${r.warehouseId}\t${r.dockCode}`;
    const arr = groups.get(k) ?? [];
    arr.push(r);
    groups.set(k, arr);
  }

  const hints: Bf90AdvisoryHint[] = [];
  const dockQueues: Bf90DockQueueSummary[] = [];

  for (const [, arr] of groups) {
    arr.sort((x, y) => x.windowStart.getTime() - y.windowStart.getTime());
    const slots: Bf90DockQueueSlot[] = [];

    for (let i = 0; i < arr.length; i += 1) {
      const a = arr[i]!;
      const startMs = a.windowStart.getTime();
      const endMs = a.windowEnd.getTime();

      let overlappingScheduledPeerCount = 0;
      for (let j = 0; j < arr.length; j += 1) {
        if (i === j) continue;
        const b = arr[j]!;
        if (
          intervalsOverlapInclusive(startMs, endMs, b.windowStart.getTime(), b.windowEnd.getTime())
        ) {
          overlappingScheduledPeerCount += 1;
        }
      }

      const alert = alertByApptId.get(a.id);
      const detentionBreach = alert
        ? {
            phase: alert.phase,
            minutesOver: alert.minutesOver,
            limitMinutes: alert.limitMinutes,
          }
        : null;

      const detentionPressure =
        detentionBreach === null
          ? computeDetentionPressure(a, policyModel, params.now, BF90_DETENTION_PRESSURE_LEAD_MINUTES)
          : null;

      slots.push({
        appointmentId: a.id,
        windowStart: a.windowStart.toISOString(),
        windowEnd: a.windowEnd.toISOString(),
        direction: a.direction,
        status: a.status,
        queueIndex: i,
        overlappingScheduledPeerCount,
        tmsLoadId: a.tmsLoadId,
        tmsCarrierBookingRef: a.tmsCarrierBookingRef,
        gateCheckedInAt: a.gateCheckedInAt?.toISOString() ?? null,
        atDockAt: a.atDockAt?.toISOString() ?? null,
        departedAt: a.departedAt?.toISOString() ?? null,
        detentionBreach,
        detentionPressure,
      });

      if (overlappingScheduledPeerCount > 0) {
        hints.push({
          severity: "WARN",
          kind: "OVERLAPPING_WINDOWS",
          appointmentId: a.id,
          warehouseId: a.warehouseId,
          dockCode: a.dockCode,
          message:
            "Another SCHEDULED appointment overlaps this dock window — TMS may need staggered slots or reassignment.",
          context: {
            overlappingScheduledPeerCount,
            windowStart: a.windowStart.toISOString(),
            windowEnd: a.windowEnd.toISOString(),
          },
        });
      }

      if (i >= 2) {
        hints.push({
          severity: i >= 4 ? "WARN" : "INFO",
          kind: "QUEUE_DEPTH",
          appointmentId: a.id,
          warehouseId: a.warehouseId,
          dockCode: a.dockCode,
          message: `Approximate yard queue position ${i + 1} at this dock — deep queues increase detention risk (BF-54).`,
          context: { queueIndex: i, scheduledAtDock: arr.length },
        });
      }

      if (detentionBreach) {
        hints.push({
          severity: "WARN",
          kind: "DETENTION_BREACH",
          appointmentId: a.id,
          warehouseId: a.warehouseId,
          dockCode: a.dockCode,
          message:
            detentionBreach.phase === "GATE_TO_DOCK"
              ? "BF-54 gate-to-dock detention threshold exceeded — prioritize dock assignment or adjust TMS plan."
              : "BF-54 dock dwell detention threshold exceeded — prioritize departure / unload completion.",
          context: {
            phase: detentionBreach.phase,
            minutesOver: detentionBreach.minutesOver,
            limitMinutes: detentionBreach.limitMinutes,
          },
        });
      } else if (detentionPressure) {
        hints.push({
          severity: "INFO",
          kind: "DETENTION_PRESSURE",
          appointmentId: a.id,
          warehouseId: a.warehouseId,
          dockCode: a.dockCode,
          message: `Within ${BF90_DETENTION_PRESSURE_LEAD_MINUTES} minutes of BF-54 ${detentionPressure.phase} allowance — monitor yard milestones.`,
          context: {
            phase: detentionPressure.phase,
            minutesRemaining: detentionPressure.minutesRemaining,
          },
        });
      }
    }

    const first = arr[0]!;
    dockQueues.push({
      warehouseId: first.warehouseId,
      dockCode: first.dockCode,
      scheduledCount: arr.length,
      slots,
    });
  }

  dockQueues.sort((x, y) => {
    const wc = x.warehouseId.localeCompare(y.warehouseId);
    if (wc !== 0) return wc;
    return x.dockCode.localeCompare(y.dockCode);
  });

  const severityRank = (s: Bf90HintSeverity) => (s === "WARN" ? 0 : 1);
  hints.sort((a, b) => {
    const sr = severityRank(a.severity) - severityRank(b.severity);
    if (sr !== 0) return sr;
    const dc = a.dockCode.localeCompare(b.dockCode);
    if (dc !== 0) return dc;
    return a.appointmentId.localeCompare(b.appointmentId);
  });

  return {
    schemaVersion: BF90_SCHEMA_VERSION,
    generatedAt: params.now.toISOString(),
    advisoryOnly: true,
    detentionPolicySummary,
    warehouseId: params.warehouseIdFilter,
    dockQueues,
    hints,
  };
}

export async function loadTmsAppointmentHintsBf90(
  prisma: PrismaClient,
  tenantId: string,
  opts: { warehouseId?: string | null },
): Promise<{ ok: true; doc: Bf90Doc } | { ok: false; status: number; error: string }> {
  const whRaw = opts.warehouseId?.trim() ?? "";
  const warehouseIdFilter = whRaw.length > 0 ? whRaw : null;

  if (warehouseIdFilter) {
    const w = await prisma.warehouse.findFirst({
      where: { id: warehouseIdFilter, tenantId },
      select: { id: true },
    });
    if (!w) {
      return { ok: false, status: 404, error: "Warehouse not found." };
    }
  }

  const [tenantRow, appointments] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { wmsDockDetentionPolicyJson: true },
    }),
    prisma.wmsDockAppointment.findMany({
      where: { tenantId, ...(warehouseIdFilter ? { warehouseId: warehouseIdFilter } : {}) },
      orderBy: [{ windowStart: "asc" }],
      take: 250,
      select: {
        id: true,
        warehouseId: true,
        dockCode: true,
        windowStart: true,
        windowEnd: true,
        direction: true,
        status: true,
        tmsLoadId: true,
        tmsCarrierBookingRef: true,
        gateCheckedInAt: true,
        atDockAt: true,
        departedAt: true,
      },
    }),
  ]);

  const mapped: Bf90AppointmentInput[] = appointments.map((a) => ({
    id: a.id,
    warehouseId: a.warehouseId,
    dockCode: a.dockCode,
    windowStart: a.windowStart,
    windowEnd: a.windowEnd,
    direction: a.direction,
    status: a.status,
    tmsLoadId: a.tmsLoadId,
    tmsCarrierBookingRef: a.tmsCarrierBookingRef,
    gateCheckedInAt: a.gateCheckedInAt,
    atDockAt: a.atDockAt,
    departedAt: a.departedAt,
  }));

  const doc = buildTmsAppointmentHintsBf90Doc({
    now: new Date(),
    warehouseIdFilter,
    detentionPolicyJson: tenantRow?.wmsDockDetentionPolicyJson ?? null,
    appointments: mapped,
  });

  return { ok: true, doc };
}
