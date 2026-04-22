import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const patchRiskSignalAckForTenantMock = vi.fn();
const appendTwinMutationAuditEventMock = vi.fn();

vi.mock("@/lib/authz", async () => {
  const mod = await vi.importActual<typeof import("@/lib/authz")>("@/lib/authz");
  return {
    ...mod,
    getViewerGrantSet: getViewerGrantSetMock,
    actorIsSupplierPortalRestricted: actorIsSupplierPortalRestrictedMock,
  };
});

vi.mock("@/lib/nav-visibility", () => ({
  resolveNavState: resolveNavStateMock,
}));

vi.mock("@/lib/supply-chain-twin/risk-signals-repo", async () => {
  const mod = await vi.importActual<typeof import("@/lib/supply-chain-twin/risk-signals-repo")>(
    "@/lib/supply-chain-twin/risk-signals-repo",
  );
  return {
    ...mod,
    patchRiskSignalAckForTenant: patchRiskSignalAckForTenantMock,
  };
});

vi.mock("@/lib/supply-chain-twin/mutation-audit", () => ({
  appendTwinMutationAuditEvent: appendTwinMutationAuditEventMock,
}));

describe("PATCH /api/supply-chain-twin/risk-signals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
  });

  it("returns 404 for cross-tenant or missing id", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(),
    });
    resolveNavStateMock.mockResolvedValue({
      linkVisibility: { supplyChainTwin: true },
      setupIncomplete: false,
      poSubNavVisibility: {},
    });
    patchRiskSignalAckForTenantMock.mockResolvedValue({ ok: false, reason: "not_found" });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/supply-chain-twin/risk-signals/r1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: true }),
      }),
      { params: Promise.resolve({ id: "r1" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found.", code: "NOT_FOUND" });
  });

  it("returns 200 for repeated idempotent ack requests", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(),
    });
    resolveNavStateMock.mockResolvedValue({
      linkVisibility: { supplyChainTwin: true },
      setupIncomplete: false,
      poSubNavVisibility: {},
    });
    const at = new Date("2026-04-21T10:00:00.000Z");
    patchRiskSignalAckForTenantMock.mockResolvedValue({
      ok: true,
      row: {
        id: "r1",
        acknowledged: true,
        acknowledgedAt: at,
        acknowledgedByActorId: "u1",
      },
    });

    const { PATCH } = await import("./route");
    const req = () =>
      PATCH(
        new Request("http://localhost/api/supply-chain-twin/risk-signals/r1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acknowledged: true }),
        }),
        { params: Promise.resolve({ id: "r1" }) },
      );

    const first = await req();
    const second = await req();

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      id: "r1",
      acknowledged: true,
      acknowledgedAt: "2026-04-21T10:00:00.000Z",
      acknowledgedByActorId: "u1",
    });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      id: "r1",
      acknowledged: true,
      acknowledgedAt: "2026-04-21T10:00:00.000Z",
      acknowledgedByActorId: "u1",
    });
    expect(patchRiskSignalAckForTenantMock).toHaveBeenCalledTimes(2);
    expect(appendTwinMutationAuditEventMock).toHaveBeenNthCalledWith(1, {
      tenantId: "t1",
      actorId: "u1",
      action: "risk_signal_ack_patched",
      targetId: "r1",
      metadata: { acknowledged: true },
    });
    expect(appendTwinMutationAuditEventMock).toHaveBeenNthCalledWith(2, {
      tenantId: "t1",
      actorId: "u1",
      action: "risk_signal_ack_patched",
      targetId: "r1",
      metadata: { acknowledged: true },
    });
  });

  it("returns 400 when body is missing acknowledged boolean", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(),
    });
    resolveNavStateMock.mockResolvedValue({
      linkVisibility: { supplyChainTwin: true },
      setupIncomplete: false,
      poSubNavVisibility: {},
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/supply-chain-twin/risk-signals/r1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "r1" }) },
    );

    expect(response.status).toBe(400);
    expect(patchRiskSignalAckForTenantMock).not.toHaveBeenCalled();
  });
});
