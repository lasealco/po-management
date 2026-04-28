import { describe, expect, it } from "vitest";

import {
  buildApplyConflictExplanation,
  buildConnectorEvidence,
  buildStagingEvidence,
  redactApiHubAssistantValue,
} from "./assistant-evidence";

describe("API Hub assistant evidence", () => {
  it("redacts secret-shaped fields recursively", () => {
    expect(redactApiHubAssistantValue({ authConfigRef: "vault://x", nested: { token: "abc", ok: true } })).toEqual({
      authConfigRef: "[REDACTED]",
      nested: { token: "[REDACTED]", ok: true },
    });
  });

  it("builds connector and staging evidence", () => {
    expect(
      buildConnectorEvidence({
        id: "c1",
        name: "Partner",
        sourceKind: "api",
        status: "active",
        authMode: "oauth",
        authState: "configured",
        healthSummary: "Healthy",
        updatedAt: "2026-04-28T00:00:00.000Z",
      }).severity,
    ).toBe("INFO");
    expect(
      buildStagingEvidence({
        id: "b1",
        title: "Batch",
        status: "open",
        rowCount: 2,
        appliedAt: null,
        updatedAt: "2026-04-28T00:00:00.000Z",
      }).summary,
    ).toContain("2 mapped rows");
  });

  it("explains apply conflicts without implying auto-apply", () => {
    expect(
      buildApplyConflictExplanation({
        id: "x",
        ingestionRunId: "run",
        resultCode: "CONFLICT",
        httpStatus: 409,
        dryRun: true,
        connectorId: null,
      }),
    ).toContain("cannot apply or mutate downstream records silently");
  });
});
