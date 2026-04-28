import { describe, expect, it } from "vitest";

import {
  DEFAULT_ASSISTANT_ADMIN_THRESHOLDS,
  buildAssistantCompliancePacket,
  buildPermissionMatrix,
  evaluateAssistantAdminReadiness,
  normalizeAssistantAdminThresholds,
} from "./admin-console";

describe("assistant admin console helpers", () => {
  it("normalizes thresholds into bounded numbers", () => {
    const thresholds = normalizeAssistantAdminThresholds({
      evidenceCoveragePct: 120,
      releaseGateScore: 82.4,
      automationReadiness: "bad",
      maxOpenHighPriorityActions: -1,
    });
    expect(thresholds.evidenceCoveragePct).toBe(100);
    expect(thresholds.releaseGateScore).toBe(82);
    expect(thresholds.automationReadiness).toBe(DEFAULT_ASSISTANT_ADMIN_THRESHOLDS.automationReadiness);
    expect(thresholds.maxOpenHighPriorityActions).toBe(0);
  });

  it("blocks readiness when release gate or priority work fails", () => {
    const readiness = evaluateAssistantAdminReadiness(
      {
        evidenceCoveragePct: 90,
        latestReleaseGateScore: 70,
        latestReleaseGateStatus: "BLOCKED",
        enabledAutomationCount: 1,
        pausedAutomationCount: 0,
        openHighPriorityActionCount: 12,
        approvedPromptCount: 1,
        activePlaybookCount: 1,
      },
      DEFAULT_ASSISTANT_ADMIN_THRESHOLDS,
    );
    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.checks.some((check) => check.key === "release_gate" && !check.passed)).toBe(true);
  });

  it("builds compliance packet without operational mutation claims", () => {
    const readiness = evaluateAssistantAdminReadiness(
      {
        evidenceCoveragePct: 95,
        latestReleaseGateScore: 88,
        latestReleaseGateStatus: "PASSED",
        enabledAutomationCount: 1,
        pausedAutomationCount: 0,
        openHighPriorityActionCount: 0,
        approvedPromptCount: 2,
        activePlaybookCount: 2,
      },
      DEFAULT_ASSISTANT_ADMIN_THRESHOLDS,
    );
    const packet = buildAssistantCompliancePacket({
      generatedAt: "2026-04-28T00:00:00.000Z",
      tenant: { id: "tenant", name: "Demo", slug: "demo" },
      rolloutMode: "PILOT",
      pilotRoles: ["role"],
      pilotSites: ["site"],
      thresholds: DEFAULT_ASSISTANT_ADMIN_THRESHOLDS,
      signals: {
        evidenceCoveragePct: 95,
        latestReleaseGateScore: 88,
        latestReleaseGateStatus: "PASSED",
        enabledAutomationCount: 1,
        pausedAutomationCount: 0,
        openHighPriorityActionCount: 0,
        approvedPromptCount: 2,
        activePlaybookCount: 2,
      },
      readiness,
      permissionMatrix: [{ resource: "org.settings", action: "edit", label: "Edit settings", grantedRoleCount: 1 }],
    });
    expect(packet.packetType).toBe("AMP11_ASSISTANT_CONTROL_PACKET");
    expect(packet.controls.join(" ")).toContain("does not mutate operational data");
  });

  it("counts role coverage per permission", () => {
    const matrix = buildPermissionMatrix(
      [{ resource: "org.settings", action: "edit", label: "Edit settings", description: "Manage settings" }],
      [
        { resource: "org.settings", action: "edit", roleId: "role-a" },
        { resource: "org.settings", action: "edit", roleId: "role-a" },
        { resource: "org.settings", action: "edit", roleId: "role-b" },
      ],
    );
    expect(matrix[0]?.grantedRoleCount).toBe(2);
  });
});
