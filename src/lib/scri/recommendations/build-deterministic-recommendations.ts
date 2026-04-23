import type { ScriExternalEvent } from "@prisma/client";

/** Rows passed to `replaceScriEventRecommendations` (status always reset to ACTIVE on R2 run). */
export type DeterministicScriRecommendationRow = {
  recommendationType: string;
  targetObjectType?: string | null;
  targetObjectId?: string | null;
  priority: number;
  confidence: number;
  expectedEffect?: string | null;
};

const LOGISTICS_INTENSIVE_TYPES = new Set<string>([
  "PORT_CONGESTION",
  "TERMINAL_CLOSURE",
  "VESSEL_BACKLOG",
  "RAIL_DISRUPTION",
  "TRUCKING_RESTRICTION",
  "AIRPORT_DISRUPTION",
  "CANAL_TRANSIT",
  "ROUTE_SUSPENSION",
  "BORDER_DELAY",
  "CUSTOMS_RESTRICTION",
  "STRIKE",
  "OPERATIONAL_INCIDENT",
]);

const TRADE_DESK_TYPES = new Set<string>([
  "SANCTIONS",
  "TARIFF_CHANGE",
  "CUSTOMS_RESTRICTION",
  "TRADE_COMPLIANCE_CHANGE",
  "DOCUMENTATION_RULE_CHANGE",
]);

/**
 * Deterministic R5 rules from event classification + R2 match rollup.
 * Regenerated on each `runScriEventMatching` (user accept/reject/snooze is overwritten).
 */
export function buildDeterministicScriRecommendations(args: {
  event: Pick<ScriExternalEvent, "eventType" | "severity" | "title" | "shortSummary">;
  candidateShipmentCount: number;
  affectedMatchCount: number;
  affectedByType: Record<string, number>;
  firstObjectIdByType: Record<string, string>;
}): DeterministicScriRecommendationRow[] {
  const { event, candidateShipmentCount, affectedMatchCount, affectedByType, firstObjectIdByType } =
    args;

  const eventType = event.eventType;
  const severity = event.severity;
  const out: DeterministicScriRecommendationRow[] = [];

  const shipN = affectedByType.SHIPMENT ?? 0;
  const whN = affectedByType.WAREHOUSE ?? 0;
  const invN = affectedByType.INVENTORY_BALANCE ?? 0;
  const poN = affectedByType.PURCHASE_ORDER ?? 0;

  if (severity === "CRITICAL" || eventType === "WAR_ESCALATION") {
    out.push({
      recommendationType: "EXEC_ESCALATION",
      priority: 92,
      confidence: severity === "CRITICAL" ? 88 : 80,
      expectedEffect:
        "Critical or geopolitical event family: ensure executive visibility and a single decision owner.",
    });
  }

  const logisticsType =
    LOGISTICS_INTENSIVE_TYPES.has(eventType) || eventType === "WAR_ESCALATION";
  if (severity === "HIGH" || severity === "CRITICAL" || logisticsType) {
    out.push({
      recommendationType: "CONTACT_LOGISTICS_PARTNER",
      priority: severity === "CRITICAL" ? 86 : 80,
      confidence: 72,
      expectedEffect:
        "Confirm booking status, reroutes, and dwell with carrier / forwarder on impacted lanes.",
    });
  }

  if (whN > 0 && firstObjectIdByType.WAREHOUSE) {
    out.push({
      recommendationType: "ALERT_AFFECTED_SITE",
      targetObjectType: "WAREHOUSE",
      targetObjectId: firstObjectIdByType.WAREHOUSE,
      priority: 74,
      confidence: 66,
      expectedEffect:
        "Notify warehouse / DC operations of potential inbound disruption or diversion in the event geography.",
    });
  }

  if (invN > 0 && firstObjectIdByType.INVENTORY_BALANCE) {
    out.push({
      recommendationType: "VERIFY_STOCK_POSITION",
      targetObjectType: "INVENTORY_BALANCE",
      targetObjectId: firstObjectIdByType.INVENTORY_BALANCE,
      priority: 68,
      confidence: 60,
      expectedEffect:
        "Validate on-hand and reserved quantities at affected locations for constrained SKUs.",
    });
  }

  if (candidateShipmentCount > 3) {
    out.push({
      recommendationType: "NARROW_SHIPMENT_CANDIDATES",
      priority: 54,
      confidence: 58,
      expectedEffect:
        "Multiple shipments share geography signals; confirm time windows and legs before committing actions.",
    });
  }

  if (poN >= 6 || shipN >= 6) {
    out.push({
      recommendationType: "TRIAGE_WIDE_PO_EXPOSURE",
      priority: 56,
      confidence: 55,
      expectedEffect:
        "Large number of POs or shipments matched; prioritize by revenue, SLA, or single-site concentration.",
    });
  }

  if (TRADE_DESK_TYPES.has(eventType)) {
    out.push({
      recommendationType: "TRADE_COMPLIANCE_DESK",
      priority: 78,
      confidence: 74,
      expectedEffect:
        "Route to trade compliance for HS, licenses, sanctions, or documentation rule changes.",
    });
  }

  if (affectedMatchCount === 0) {
    out.push({
      recommendationType: "CONFIRM_GEO_COVERAGE",
      priority: 40,
      confidence: 52,
      expectedEffect:
        "No internal objects matched R2 rules; refine event geography or extend reference data (UN/LOC, regions).",
    });
  }

  const byType = new Map(out.map((r) => [r.recommendationType, r]));
  return [...byType.values()].sort((a, b) => b.priority - a.priority);
}
