import { describe, expect, it } from "vitest";

import { toApiHubIngestionRunDto } from "./ingestion-run-dto";

describe("toApiHubIngestionRunDto", () => {
  it("serializes run timestamps and nullable fields", () => {
    const out = toApiHubIngestionRunDto({
      id: "run_1",
      connectorId: "conn_1",
      requestedByUserId: "user_1",
      idempotencyKey: "key_123",
      status: "running",
      triggerKind: "manual",
      attempt: 1,
      maxAttempts: 3,
      resultSummary: null,
      errorCode: null,
      errorMessage: null,
      enqueuedAt: new Date("2026-04-20T10:00:00.000Z"),
      startedAt: new Date("2026-04-20T10:01:00.000Z"),
      finishedAt: null,
      retryOfRunId: null,
      appliedAt: null,
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:02:00.000Z"),
    });

    expect(out.appliedAt).toBeNull();
    expect(out.enqueuedAt).toBe("2026-04-20T10:00:00.000Z");
    expect(out.startedAt).toBe("2026-04-20T10:01:00.000Z");
    expect(out.finishedAt).toBeNull();
    expect(out.idempotencyKey).toBe("key_123");
    expect(out.triggerKind).toBe("manual");
    expect(out.retryOfRunId).toBeNull();
  });

  it("defaults triggerKind to api when omitted on row", () => {
    const out = toApiHubIngestionRunDto({
      id: "run_2",
      connectorId: null,
      requestedByUserId: "user_1",
      idempotencyKey: null,
      status: "queued",
      attempt: 1,
      maxAttempts: 3,
      resultSummary: null,
      errorCode: null,
      errorMessage: null,
      enqueuedAt: new Date("2026-04-20T10:00:00.000Z"),
      startedAt: null,
      finishedAt: null,
      retryOfRunId: null,
      appliedAt: new Date("2026-04-20T10:03:00.000Z"),
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    });
    expect(out.triggerKind).toBe("api");
    expect(out.appliedAt).toBe("2026-04-20T10:03:00.000Z");
  });
});
