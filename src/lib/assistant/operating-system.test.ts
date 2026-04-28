import { describe, expect, it } from "vitest";

import {
  buildAssistantBoardReport,
  buildAssistantDemoScript,
  computeAssistantOperatingScore,
  type AssistantOperatingSignals,
} from "./operating-system";

const strongSignals: AssistantOperatingSignals = {
  auditTotal: 20,
  evidenceRecordCount: 20,
  pendingActionCount: 0,
  completedActionCount: 12,
  activePlaybookCount: 2,
  completedPlaybookCount: 4,
  approvedPromptCount: 3,
  releaseGateScore: 90,
  releaseGatePassed: true,
  enabledAutomationCount: 2,
  adminPacketReady: true,
  apiHubOpenReviewCount: 0,
  twinOpenInsightCount: 0,
};

describe("assistant operating system helpers", () => {
  it("scores customer-ready signals higher than blocked signals", () => {
    const blocked = computeAssistantOperatingScore({
      ...strongSignals,
      evidenceRecordCount: 1,
      pendingActionCount: 10,
      releaseGateScore: 20,
      releaseGatePassed: false,
      adminPacketReady: false,
      apiHubOpenReviewCount: 5,
      twinOpenInsightCount: 4,
    });
    const ready = computeAssistantOperatingScore(strongSignals);
    expect(ready).toBeGreaterThan(blocked);
  });

  it("builds a six-step customer demo script", () => {
    const script = buildAssistantDemoScript(strongSignals);
    expect(script).toHaveLength(6);
    expect(script.map((step) => step.href)).toContain("/assistant/admin");
    expect(script.map((step) => step.href)).toContain("/assistant/operating-system");
  });

  it("builds a board report with limitations and metrics", () => {
    const report = buildAssistantBoardReport({
      generatedAt: "2026-04-28T00:00:00.000Z",
      tenantName: "Demo Company",
      signals: strongSignals,
    });
    expect(report.reportType).toBe("AMP12_ASSISTANT_OPERATING_SYSTEM_REPORT");
    expect(report.status).toBe("CUSTOMER_READY");
    expect(report.executiveSummary).toContain("Assistant operating score");
    expect(report.limitations.join(" ")).toContain("human approval");
  });
});
