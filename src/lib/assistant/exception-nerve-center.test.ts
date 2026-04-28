import { describe, expect, it } from "vitest";

import {
  buildCustomerSafeIncidentSummary,
  buildExceptionIncidentDraft,
  computeIncidentSeverity,
  findDuplicateIncidentGroups,
  mergeIncidentDrafts,
  normalizeExceptionSeverity,
  type ExceptionSignal,
} from "@/lib/assistant/exception-nerve-center";

const baseSignal: ExceptionSignal = {
  id: "signal-1",
  module: "Control Tower",
  objectType: "ct_exception",
  objectId: "ex-1",
  title: "Late shipment",
  detail: "ETA missed",
  severity: "HIGH",
  status: "OPEN",
  href: "/control-tower/shipments/1",
  customerLabel: "Acme",
  ownerLabel: "Ops",
  occurredAt: "2026-04-28T00:00:00.000Z",
  dedupeKey: "shipment:1",
};

describe("exception nerve center helpers", () => {
  it("normalizes severity vocabulary across modules", () => {
    expect(normalizeExceptionSeverity("RED")).toBe("CRITICAL");
    expect(normalizeExceptionSeverity("WARN")).toBe("HIGH");
    expect(normalizeExceptionSeverity("info")).toBe("LOW");
    expect(normalizeExceptionSeverity(undefined)).toBe("MEDIUM");
  });

  it("scores severity higher when several modules are involved", () => {
    const severity = computeIncidentSeverity([
      baseSignal,
      { ...baseSignal, id: "signal-2", module: "WMS", objectType: "wms_task", objectId: "task-1", severity: "MEDIUM" },
      { ...baseSignal, id: "signal-3", module: "Invoice audit", objectType: "invoice_intake", objectId: "inv-1", severity: "CRITICAL" },
    ]);

    expect(severity.severity).toBe("CRITICAL");
    expect(severity.score).toBeGreaterThanOrEqual(90);
  });

  it("detects duplicate groups by shared dedupe key", () => {
    const groups = findDuplicateIncidentGroups([
      baseSignal,
      { ...baseSignal, id: "signal-2", module: "WMS", objectType: "wms_task", objectId: "task-1" },
      { ...baseSignal, id: "signal-3", dedupeKey: "supplier:2", module: "SRM", objectType: "notification", objectId: "n-1" },
    ]);

    expect(groups[0]?.dedupeKey).toBe("shipment:1");
    expect(groups[0]?.modules).toEqual(["Control Tower", "WMS"]);
  });

  it("builds incident drafts with playbooks and customer-safe drafts", () => {
    const draft = buildExceptionIncidentDraft({
      signals: [
        baseSignal,
        { ...baseSignal, id: "signal-2", module: "WMS", objectType: "wms_task", objectId: "task-1", title: "Pick task aged" },
      ],
    });

    expect(draft.title).toContain("across 2 modules");
    expect(draft.playbook).toHaveLength(5);
    expect(draft.communicationDraft.customer).toContain("avoids internal cost");
    expect(buildCustomerSafeIncidentSummary(draft)).toContain("internal cost, supplier, and invoice details are withheld");
  });

  it("merges incident drafts without duplicating linked objects", () => {
    const primary = buildExceptionIncidentDraft({ signals: [baseSignal] });
    const secondary = buildExceptionIncidentDraft({
      signals: [
        { ...baseSignal, id: "signal-2", module: "WMS", objectType: "wms_task", objectId: "task-1", severity: "MEDIUM" },
        baseSignal,
      ],
    });

    const merged = mergeIncidentDrafts(primary, secondary);
    expect(merged.linkedObjects).toHaveLength(2);
    expect(merged.blastRadius.modules).toEqual(["Control Tower", "WMS"]);
  });
});
