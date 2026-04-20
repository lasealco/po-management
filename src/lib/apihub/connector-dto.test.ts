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
    expect(out.auditTrail).toEqual([]);
  });

  it("serializes optional audit trail rows", () => {
    const out = toApiHubConnectorDto({
      id: "c2",
      name: "ERP feed",
      sourceKind: "api",
      status: "active",
      lastSyncAt: new Date("2026-04-21T09:00:00.000Z"),
      healthSummary: "Healthy",
      createdAt: new Date("2026-04-21T08:00:00.000Z"),
      updatedAt: new Date("2026-04-21T09:01:00.000Z"),
      auditLogs: [
        {
          id: "a1",
          actorUserId: "u1",
          action: "connector.lifecycle.updated",
          note: "Set to active and marked synced.",
          createdAt: new Date("2026-04-21T09:01:00.000Z"),
        },
      ],
    });
    expect(out.auditTrail).toEqual([
      {
        id: "a1",
        actorUserId: "u1",
        action: "connector.lifecycle.updated",
        note: "Set to active and marked synced.",
        createdAt: "2026-04-21T09:01:00.000Z",
      },
    ]);
  });
});
