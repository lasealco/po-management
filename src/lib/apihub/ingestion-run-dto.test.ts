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
      attempt: 1,
      maxAttempts: 3,
      resultSummary: null,
      errorCode: null,
      errorMessage: null,
      enqueuedAt: new Date("2026-04-20T10:00:00.000Z"),
      startedAt: new Date("2026-04-20T10:01:00.000Z"),
      finishedAt: null,
      retryOfRunId: null,
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:02:00.000Z"),
    });

    expect(out.enqueuedAt).toBe("2026-04-20T10:00:00.000Z");
    expect(out.startedAt).toBe("2026-04-20T10:01:00.000Z");
    expect(out.finishedAt).toBeNull();
    expect(out.idempotencyKey).toBe("key_123");
    expect(out.retryOfRunId).toBeNull();
  });
});
