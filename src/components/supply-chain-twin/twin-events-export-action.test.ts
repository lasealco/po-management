import { describe, expect, it, vi } from "vitest";

import { buildTwinEventsExportUrl, inferTwinEventsExportFilename } from "./twin-events-export-action";

describe("twin-events-export-action helpers", () => {
  it("preserves supported filters when building export URL", () => {
    const params = new URLSearchParams({
      since: "2026-01-01T00:00:00.000Z",
      until: "2026-01-02T00:00:00.000Z",
      type: "entity_*",
      includePayload: "false",
      ignored: "x",
    });

    const url = buildTwinEventsExportUrl(params, "csv");
    expect(url).toContain("/api/supply-chain-twin/events/export?");
    expect(url).toContain("since=2026-01-01T00%3A00%3A00.000Z");
    expect(url).toContain("until=2026-01-02T00%3A00%3A00.000Z");
    expect(url).toContain("type=entity_*");
    expect(url).toContain("includePayload=false");
    expect(url).toContain("format=csv");
    expect(url).not.toContain("ignored=");
  });

  it("trims whitespace around copied filter values", () => {
    const params = new URLSearchParams({
      type: "  entity_*  ",
      includePayload: "  false  ",
      since: " 2026-01-01T00:00:00.000Z ",
    });

    const url = buildTwinEventsExportUrl(params, "json");
    expect(url).toContain("type=entity_*");
    expect(url).toContain("includePayload=false");
    expect(url).toContain("since=2026-01-01T00%3A00%3A00.000Z");
    expect(url).toContain("format=json");
  });

  it("drops blank filters after normalization", () => {
    const params = new URLSearchParams({
      type: "   ",
      eventType: "",
      includePayload: "  ",
      since: "2026-01-01T00:00:00.000Z",
    });

    const url = buildTwinEventsExportUrl(params, "csv");
    expect(url).toContain("since=2026-01-01T00%3A00%3A00.000Z");
    expect(url).toContain("format=csv");
    expect(url).not.toContain("type=");
    expect(url).not.toContain("eventType=");
    expect(url).not.toContain("includePayload=");
  });

  it("prefers type over legacy eventType when both are present", () => {
    const params = new URLSearchParams({
      type: "entity_*",
      eventType: "legacy_value",
      since: "2026-01-01T00:00:00.000Z",
    });

    const url = buildTwinEventsExportUrl(params, "csv");
    expect(url).toContain("type=entity_*");
    expect(url).not.toContain("eventType=");
  });

  it("keeps legacy eventType when type is absent", () => {
    const params = new URLSearchParams({
      eventType: "legacy_value",
      since: "2026-01-01T00:00:00.000Z",
    });

    const url = buildTwinEventsExportUrl(params, "json");
    expect(url).toContain("eventType=legacy_value");
    expect(url).not.toContain("type=");
    expect(url).toContain("format=json");
  });

  it("builds deterministic timestamped filename format", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:34:56.000Z"));
    expect(inferTwinEventsExportFilename("json")).toBe("sctwin-events-export-2026-01-01T1234.json");
    expect(inferTwinEventsExportFilename("csv")).toBe("sctwin-events-export-2026-01-01T1234.csv");
    vi.useRealTimers();
  });
});
