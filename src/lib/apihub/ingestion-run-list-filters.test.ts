import { describe, expect, it } from "vitest";

import {
  parseIngestionRunListAttemptRangeParam,
  parseIngestionRunListConnectorIdParam,
  parseIngestionRunListTriggerKindParam,
} from "./ingestion-run-list-filters";

describe("parseIngestionRunListConnectorIdParam", () => {
  it("returns null when omitted or blank", () => {
    expect(parseIngestionRunListConnectorIdParam(null)).toEqual({ ok: true, connectorId: null });
    expect(parseIngestionRunListConnectorIdParam("  ")).toEqual({ ok: true, connectorId: null });
  });

  it("accepts cuid-like ids", () => {
    expect(parseIngestionRunListConnectorIdParam("clabcdefghijklmnopqrs")).toEqual({
      ok: true,
      connectorId: "clabcdefghijklmnopqrs",
    });
  });

  it("rejects invalid ids", () => {
    expect(parseIngestionRunListConnectorIdParam("bad id!").ok).toBe(false);
    expect(parseIngestionRunListConnectorIdParam("short").ok).toBe(false);
  });
});

describe("parseIngestionRunListTriggerKindParam", () => {
  it("accepts allowlisted kinds", () => {
    expect(parseIngestionRunListTriggerKindParam("API")).toEqual({ ok: true, triggerKind: "api" });
    expect(parseIngestionRunListTriggerKindParam("manual")).toEqual({ ok: true, triggerKind: "manual" });
  });

  it("rejects unknown kinds", () => {
    expect(parseIngestionRunListTriggerKindParam("webhook").ok).toBe(false);
  });
});

describe("parseIngestionRunListAttemptRangeParam", () => {
  it("parses single attempt and ranges", () => {
    expect(parseIngestionRunListAttemptRangeParam("3")).toEqual({ ok: true, attemptRange: { min: 3, max: 3 } });
    expect(parseIngestionRunListAttemptRangeParam("1-3")).toEqual({ ok: true, attemptRange: { min: 1, max: 3 } });
  });

  it("rejects inverted ranges and garbage", () => {
    expect(parseIngestionRunListAttemptRangeParam("3-1").ok).toBe(false);
    expect(parseIngestionRunListAttemptRangeParam("1-2-3").ok).toBe(false);
  });
});
