import { describe, expect, it } from "vitest";

import {
  buildEvidenceChecklist,
  buildFrontlinePacket,
  buildFrontlineQueue,
  buildOfflineRisks,
  buildQuickActions,
  type FrontlineInputs,
} from "./frontline";

const inputs: FrontlineInputs = {
  work: [
    {
      id: "wms-1",
      sourceType: "WMS_TASK",
      title: "PICK SKU-1 at WH-DEMO-DC1",
      status: "OPEN",
      role: "WAREHOUSE",
      priority: "HIGH",
      objectHref: "/wms",
      ageHours: 30,
      hasEvidence: false,
      requiresNetwork: true,
    },
    {
      id: "ship-1",
      sourceType: "CT_EXCEPTION",
      title: "Delay on SHP-1",
      status: "OPEN",
      role: "DRIVER",
      priority: "CRITICAL",
      objectHref: "/control-tower/shipments/ship-1",
      ageHours: 10,
      hasEvidence: true,
      requiresNetwork: true,
    },
    {
      id: "supplier-task-1",
      sourceType: "SUPPLIER_TASK",
      title: "Supplier: confirm certificate",
      status: "OPEN",
      role: "SUPPLIER",
      priority: "MEDIUM",
      objectHref: "/srm/portal",
      ageHours: 3,
      hasEvidence: false,
      requiresNetwork: false,
    },
  ],
  evidence: [
    {
      id: "doc-1",
      sourceType: "SHIPMENT_DOCUMENT",
      objectId: "ship-1",
      label: "POD photo",
      capturedAt: "2026-04-28T00:00:00.000Z",
      mobileFriendly: true,
    },
  ],
  permissions: [
    { role: "WAREHOUSE", canView: true, canAct: true },
    { role: "DRIVER", canView: true, canAct: false },
    { role: "SUPPLIER", canView: true, canAct: true },
    { role: "OPS", canView: true, canAct: false },
  ],
};

describe("frontline assistant helpers", () => {
  it("builds a priority-sorted mobile queue", () => {
    const queue = buildFrontlineQueue(inputs.work);

    expect(queue[0].sourceType).toBe("CT_EXCEPTION");
    expect(queue[0].mobileLabel).toContain("DRIVER");
    expect(queue[0].nextStep).toContain("field update");
  });

  it("scopes quick actions by role permissions", () => {
    const queue = buildFrontlineQueue(inputs.work);
    const actions = buildQuickActions(queue, inputs.permissions);

    expect(actions.find((action) => action.role === "WAREHOUSE")?.enabled).toBe(true);
    expect(actions.find((action) => action.role === "DRIVER")?.enabled).toBe(false);
    expect(actions.every((action) => action.guardrail.includes("does not complete tasks"))).toBe(true);
  });

  it("tracks evidence gaps without mutating source records", () => {
    const queue = buildFrontlineQueue(inputs.work);
    const checklist = buildEvidenceChecklist(queue, inputs.evidence);

    expect(checklist.missingCount).toBe(2);
    expect(checklist.items.find((item) => item.sourceId === "ship-1")?.status).toBe("READY");
    expect(checklist.items.find((item) => item.sourceId === "wms-1")?.requiredEvidence).toContain("Photo");
  });

  it("surfaces offline conflict risks for live confirmations", () => {
    const queue = buildFrontlineQueue(inputs.work);
    const risks = buildOfflineRisks(queue);

    expect(risks.map((risk) => risk.sourceId)).toEqual(expect.arrayContaining(["wms-1", "ship-1"]));
    expect(risks[0].mitigation).toContain("queue supervisor review");
  });

  it("builds a review-gated frontline packet", () => {
    const packet = buildFrontlinePacket(inputs);

    expect(packet.readinessScore).toBeGreaterThan(0);
    expect(packet.quickActionCount).toBe(3);
    expect(packet.evidenceGapCount).toBe(2);
    expect(packet.offlineRiskCount).toBeGreaterThan(0);
    expect(packet.leadershipSummary).toContain("no WMS task completion");
  });
});
