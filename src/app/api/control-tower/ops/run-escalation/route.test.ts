import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const runSlaEscalationsForTenantMock = vi.fn();
const writeCtAuditMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/control-tower/sla-escalation", () => ({
  runSlaEscalationsForTenant: runSlaEscalationsForTenantMock,
}));

vi.mock("@/lib/control-tower/audit", () => ({
  writeCtAudit: writeCtAuditMock,
}));

describe("POST /api/control-tower/ops/run-escalation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    runSlaEscalationsForTenantMock.mockResolvedValue({ escalatedCount: 3, dryRun: false });
    writeCtAuditMock.mockResolvedValue(undefined);
  });

  it("returns gate response parity when grant check denies", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden." }), { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/control-tower/ops/run-escalation", { method: "POST" }));

    expect(response).toBe(gate);
  });

  it("returns stable tenant-missing error payload", async () => {
    getDemoTenantMock.mockResolvedValueOnce(null);

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/control-tower/ops/run-escalation", { method: "POST" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Tenant not found." });
  });

  it("returns stable actor-missing error payload", async () => {
    getActorUserIdMock.mockResolvedValueOnce(null);

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/control-tower/ops/run-escalation", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "No active user." });
  });

  it("treats invalid JSON as empty body and still returns success shape", async () => {
    const request = new Request("http://localhost/api/control-tower/ops/run-escalation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    const { POST } = await import("./route");
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, escalatedCount: 3, dryRun: false });
    expect(runSlaEscalationsForTenantMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorUserId: "user-1",
      dryRun: false,
    });
  });

  it("passes dryRun=true through and writes audit payload", async () => {
    runSlaEscalationsForTenantMock.mockResolvedValueOnce({ escalatedCount: 0, dryRun: true });

    const request = new Request("http://localhost/api/control-tower/ops/run-escalation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dryRun: true }),
    });

    const { POST } = await import("./route");
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, escalatedCount: 0, dryRun: true });
    expect(runSlaEscalationsForTenantMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorUserId: "user-1",
      dryRun: true,
    });
    expect(writeCtAuditMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      shipmentId: null,
      entityType: "ControlTowerOps",
      entityId: "sla_escalation",
      action: "ops_run_sla_escalation",
      actorUserId: "user-1",
      payload: { escalatedCount: 0, dryRun: true },
    });
  });
});
