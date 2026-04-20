import { describe, expect, it } from "vitest";

import { toApiHubConnectorDto } from "./connector-dto";

describe("toApiHubConnectorDto", () => {
  it("serializes dates to ISO strings and null lastSyncAt", () => {
    const created = new Date("2026-04-20T12:00:00.000Z");
    const updated = new Date("2026-04-20T15:30:00.000Z");
    const out = toApiHubConnectorDto({
      id: "c1",
      name: "Test",
      sourceKind: "stub",
      status: "draft",
      lastSyncAt: null,
      healthSummary: "ok",
      createdAt: created,
      updatedAt: updated,
    });
    expect(out.lastSyncAt).toBeNull();
    expect(out.createdAt).toBe("2026-04-20T12:00:00.000Z");
    expect(out.updatedAt).toBe("2026-04-20T15:30:00.000Z");
    expect(out.healthSummary).toBe("ok");
  });
});
