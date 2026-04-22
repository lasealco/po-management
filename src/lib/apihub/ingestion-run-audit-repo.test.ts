import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubIngestionRunAuditLog: {
      create: h.create,
    },
  },
}));

import { prisma } from "@/lib/prisma";

import { appendApiHubIngestionRunAuditLog } from "./ingestion-run-audit-repo";

describe("appendApiHubIngestionRunAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.create.mockResolvedValue({});
  });

  it("persists structured metadata", async () => {
    await appendApiHubIngestionRunAuditLog({
      tenantId: "t1",
      actorUserId: "u1",
      ingestionRunId: "run-1",
      action: "apihub.ingestion_run.apply",
      metadata: {
        schemaVersion: 1,
        resourceType: "ingestion_run",
        requestId: "req-1",
        verb: "apply",
        resultCode: "APPLY_COMMITTED",
        httpStatus: 200,
        outcome: "success",
      },
    });
    expect(prisma.apiHubIngestionRunAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t1",
        actorUserId: "u1",
        ingestionRunId: "run-1",
        action: "apihub.ingestion_run.apply",
        metadata: expect.objectContaining({ resultCode: "APPLY_COMMITTED" }),
      }),
    });
  });
});
