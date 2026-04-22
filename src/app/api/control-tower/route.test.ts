import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const handleControlTowerPostMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/control-tower/post-actions", () => ({
  handleControlTowerPost: handleControlTowerPostMock,
}));

describe("POST /api/control-tower", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    handleControlTowerPostMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  it("returns gate response parity when grant check denies", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden." }), { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/control-tower", { method: "POST" }));

    expect(response).toBe(gate);
  });

  it("returns stable tenant-missing error payload", async () => {
    getDemoTenantMock.mockResolvedValueOnce(null);

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/control-tower", { method: "POST" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Tenant not found.", code: "NOT_FOUND" });
  });

  it("passes object body through on happy path", async () => {
    const requestBody = { action: "mark_seen", shipmentId: "ship-1" };
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/control-tower", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(handleControlTowerPostMock).toHaveBeenCalledWith("tenant-1", requestBody);
  });

  it("uses empty object body when JSON is invalid", async () => {
    const { POST } = await import("./route");
    await POST(
      new Request("http://localhost/api/control-tower", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );

    expect(handleControlTowerPostMock).toHaveBeenCalledWith("tenant-1", {});
  });
});
