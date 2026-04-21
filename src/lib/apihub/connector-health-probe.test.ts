import { describe, expect, it } from "vitest";

import { buildApiHubConnectorHealthPayload } from "./connector-health-probe";

describe("buildApiHubConnectorHealthPayload", () => {
  const fixed = new Date("2026-04-22T12:00:00.000Z");

  it("returns up with ready registry row", () => {
    const out = buildApiHubConnectorHealthPayload(
      {
        sourceKind: "stub",
        status: "active",
        authMode: "none",
        authState: "not_configured",
        authConfigRef: null,
        lastSyncAt: new Date("2026-04-22T11:00:00.000Z"),
      },
      fixed,
    );
    expect(out.state).toBe("up");
    expect(out.readinessOverall).toBe("ready");
    expect(out.readinessReasons).toEqual([]);
    expect(out.summary).toContain("ready");
    expect(out.checkedAt).toBe("2026-04-22T12:00:00.000Z");
    expect(out.lastSyncAt).toBe("2026-04-22T11:00:00.000Z");
  });

  it("returns degraded for draft stub", () => {
    const out = buildApiHubConnectorHealthPayload(
      {
        sourceKind: "stub",
        status: "draft",
        authMode: "none",
        authState: "not_configured",
        authConfigRef: null,
        lastSyncAt: null,
      },
      fixed,
    );
    expect(out.state).toBe("degraded");
    expect(out.readinessOverall).toBe("attention");
    expect(out.readinessReasons).toEqual(["STATUS_DRAFT"]);
    expect(out.summary).toContain("draft");
  });

  it("returns down when lifecycle is error", () => {
    const out = buildApiHubConnectorHealthPayload(
      {
        sourceKind: "api",
        status: "error",
        authMode: "none",
        authState: "not_configured",
        authConfigRef: null,
        lastSyncAt: null,
      },
      fixed,
    );
    expect(out.state).toBe("down");
    expect(out.readinessOverall).toBe("blocked");
    expect(out.summary).toContain("error");
  });
});
