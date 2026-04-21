import { beforeEach, describe, expect, it, vi } from "vitest";

const { findConnector, findRun, createRun } = vi.hoisted(() => ({
  findConnector: vi.fn(),
  findRun: vi.fn(),
  createRun: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubConnector: { findFirst: findConnector },
    apiHubIngestionRun: { findFirst: findRun, create: createRun },
  },
}));

import { createApiHubIngestionRun } from "./ingestion-runs-repo";

describe("createApiHubIngestionRun retry budget (Slice 25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findRun.mockResolvedValue(null);
    createRun.mockResolvedValue({ id: "run-1" });
  });

  it("sets maxAttempts from policy for api (default)", async () => {
    await createApiHubIngestionRun({
      tenantId: "t1",
      actorUserId: "u1",
      connectorId: null,
      idempotencyKey: null,
    });
    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ triggerKind: "api", maxAttempts: 3 }),
      }),
    );
  });

  it("sets maxAttempts from policy for manual trigger", async () => {
    await createApiHubIngestionRun({
      tenantId: "t1",
      actorUserId: "u1",
      connectorId: null,
      idempotencyKey: null,
      triggerKind: "manual",
    });
    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ triggerKind: "manual", maxAttempts: 5 }),
      }),
    );
  });

  it("sets maxAttempts from policy for scheduled trigger", async () => {
    await createApiHubIngestionRun({
      tenantId: "t1",
      actorUserId: "u1",
      connectorId: null,
      idempotencyKey: null,
      triggerKind: "scheduled",
    });
    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ triggerKind: "scheduled", maxAttempts: 2 }),
      }),
    );
  });

  it("validates connector before create when connectorId set", async () => {
    findConnector.mockResolvedValue({ id: "c1" });
    await createApiHubIngestionRun({
      tenantId: "t1",
      actorUserId: "u1",
      connectorId: "c1",
      idempotencyKey: null,
      triggerKind: "api",
    });
    expect(findConnector).toHaveBeenCalled();
    expect(createRun).toHaveBeenCalled();
  });
});
