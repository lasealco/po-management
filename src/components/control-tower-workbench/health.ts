import type { ShipmentHealthState, WorkbenchRow } from "@/components/control-tower-workbench/types";

export function classifyShipmentHealth(row: WorkbenchRow, nowMs: number): ShipmentHealthState {
  if (row.bookingSlaBreached) return "at_risk";
  const nextAction = row.nextAction || "";
  if (nextAction.startsWith("Escalate booking")) return "at_risk";
  if (nextAction.startsWith("Send booking")) return "missing_data";
  const etaIso = row.latestEta || row.eta;
  const etaMs = etaIso ? new Date(etaIso).getTime() : Number.NaN;
  const hasTracking = Boolean(row.trackingMilestoneSummary?.next || (row.trackingMilestoneSummary?.openCount ?? 0) > 0);
  const hasRoutePlan = Boolean(row.nextAction);
  if (!hasTracking && !hasRoutePlan) return "missing_data";
  if (row.receivedAt && Number.isFinite(etaMs)) {
    return new Date(row.receivedAt).getTime() <= etaMs ? "good" : "delayed";
  }
  if (Number.isFinite(etaMs) && etaMs < nowMs) return "delayed";
  if ((row.openQueueCounts?.openAlerts ?? 0) > 0 || (row.openQueueCounts?.openExceptions ?? 0) > 0) return "at_risk";
  if (row.trackingMilestoneSummary?.next?.isLate) return "at_risk";
  return "good";
}

export function healthBadgeClass(health: ShipmentHealthState): string {
  if (health === "good") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (health === "at_risk") return "border-amber-200 bg-amber-50 text-amber-950";
  if (health === "delayed") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-zinc-300 bg-zinc-100 text-zinc-700";
}

export function healthLabel(health: ShipmentHealthState): string {
  if (health === "good") return "On-time";
  if (health === "at_risk") return "At risk";
  if (health === "delayed") return "Delayed";
  return "Missing plan/tracking";
}
