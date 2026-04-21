import { describe, expect, it } from "vitest";

import { toApiHubConnectorAuditLogDto, toApiHubConnectorDto } from "./connector-dto";

describe("toApiHubConnectorAuditLogDto", () => {
  it("serializes audit log row", () => {
    const out = toApiHubConnectorAuditLogDto({
      id: "log-1",
      actorUserId: "u1",
      action: "connector.created",
      note: "ok",
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
    });
    expect(out).toEqual({
      id: "log-1",
      actorUserId: "u1",
      action: "connector.created",
      note: "ok",
      createdAt: "2026-04-21T10:00:00.000Z",
    });
  });
});

describe("toApiHubConnectorDto", () => {
  it("serializes dates to ISO strings and null lastSyncAt", () => {
    const created = new Date("2026-04-20T12:00:00.000Z");
    const updated = new Date("2026-04-20T15:30:00.000Z");
    const out = toApiHubConnectorDto({
      id: "c1",
      name: "Test",
      sourceKind: "stub",
      status: "draft",
      authMode: "none",
      authState: "not_configured",
      authConfigRef: null,
      lastSyncAt: null,
      healthSummary: "ok",
      opsNote: null,
      createdAt: created,
      updatedAt: updated,
    });
    expect(out.lastSyncAt).toBeNull();
    expect(out.opsNote).toBeNull();
    expect(out.readinessSummary.overall).toBe("attention");
    expect(out.readinessSummary.reasons).toEqual(["STATUS_DRAFT"]);
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
      authMode: "api_key_ref",
      authState: "configured",
      authConfigRef: "vault://demo/key",
      lastSyncAt: new Date("2026-04-21T09:00:00.000Z"),
      healthSummary: "Healthy",
      opsNote: "Hold until ERP cutover.",
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
    expect(out.opsNote).toBe("Hold until ERP cutover.");
    expect(out.readinessSummary.overall).toBe("ready");
    expect(out.readinessSummary.authReady).toBe(true);
    expect(out.readinessSummary.hasAuthConfigRef).toBe(true);
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
