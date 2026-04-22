import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const userHasGlobalGrantMock = vi.fn();
const applyMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({
  getActorUserId: getActorUserIdMock,
  userHasGlobalGrant: userHasGlobalGrantMock,
}));
vi.mock("@/lib/apihub/staging-batch-apply", () => ({
  applyApiHubStagingBatchToDownstream: applyMock,
}));

describe("POST /api/apihub/staging-batches/[batchId]/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    userHasGlobalGrantMock.mockResolvedValue(true);
  });

  it("returns 400 when target is invalid", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/apihub/staging-batches/b1/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "st-apply-1" },
        body: JSON.stringify({ target: "nope" }),
      }),
      { params: Promise.resolve({ batchId: "b1" }) },
    );
    expect(res.status).toBe(400);
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("returns 403 when org.orders edit is missing for sales_order", async () => {
    userHasGlobalGrantMock.mockImplementation((_uid, resource: string) =>
      Promise.resolve(resource === "org.apihub"),
    );
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/apihub/staging-batches/b1/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "st-apply-2" },
        body: JSON.stringify({ target: "sales_order", dryRun: true }),
      }),
      { params: Promise.resolve({ batchId: "b1" }) },
    );
    expect(res.status).toBe(403);
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("returns 403 when org.controltower edit is missing for control_tower_audit", async () => {
    userHasGlobalGrantMock.mockImplementation((_uid, resource: string) =>
      Promise.resolve(resource === "org.apihub"),
    );
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/apihub/staging-batches/b1/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "st-apply-3" },
        body: JSON.stringify({ target: "control_tower_audit", dryRun: true }),
      }),
      { params: Promise.resolve({ batchId: "b1" }) },
    );
    expect(res.status).toBe(403);
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("returns 200 with summary when apply succeeds", async () => {
    applyMock.mockResolvedValue({
      ok: true,
      summary: { target: "purchase_order", dryRun: true, rows: [{ rowIndex: 0, ok: true }] },
    });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/apihub/staging-batches/b1/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "st-apply-4" },
        body: JSON.stringify({ target: "purchase_order", dryRun: true }),
      }),
      { params: Promise.resolve({ batchId: "b1" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: { target: string } };
    expect(body.summary.target).toBe("purchase_order");
    expect(applyMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      batchId: "b1",
      actorUserId: "user-1",
      target: "purchase_order",
      dryRun: true,
    });
  });
});
