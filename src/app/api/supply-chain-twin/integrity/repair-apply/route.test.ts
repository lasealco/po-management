import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const applyTwinIntegrityRepairsForTenantMock = vi.fn();
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

vi.mock("@/lib/supply-chain-twin/integrity-repair-apply", () => ({
  applyTwinIntegrityRepairsForTenant: applyTwinIntegrityRepairsForTenantMock,
}));

vi.mock("@/lib/supply-chain-twin/mutation-audit", () => ({
  appendTwinMutationAuditEvent: appendTwinMutationAuditEventMock,
}));

describe("POST /api/supply-chain-twin/integrity/repair-apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
  });

  it("returns 400 when confirmApply is missing", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(["org.settings\0edit"]),
    });
    resolveNavStateMock.mockResolvedValue({
      linkVisibility: { supplyChainTwin: true },
      setupIncomplete: false,
      poSubNavVisibility: {},
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/integrity/repair-apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "confirmApply=true is required to execute integrity repair apply mode.",
      code: "BAD_INPUT",
    });
    expect(applyTwinIntegrityRepairsForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 200 with audit records when confirmed", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(["org.settings\0edit"]),
    });
    resolveNavStateMock.mockResolvedValue({
      linkVisibility: { supplyChainTwin: true },
      setupIncomplete: false,
      poSubNavVisibility: {},
    });
    applyTwinIntegrityRepairsForTenantMock.mockResolvedValue({
      checkedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "t1",
      dryRun: false,
      confirmed: true,
      attemptedActionCount: 1,
      appliedActionCount: 1,
      auditRecords: [
        {
          action: "delete_orphan_scenario_revision_missing_draft",
          targetId: "rev-1",
          reason: "scenarioDraftId draft-missing does not exist in tenant scope.",
          applied: true,
          affectedRows: 1,
        },
      ],
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/integrity/repair-apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmApply: true, maxActions: 50 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      checkedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "t1",
      dryRun: false,
      confirmed: true,
      attemptedActionCount: 1,
      appliedActionCount: 1,
      auditRecords: [
        {
          action: "delete_orphan_scenario_revision_missing_draft",
          targetId: "rev-1",
          reason: "scenarioDraftId draft-missing does not exist in tenant scope.",
          applied: true,
          affectedRows: 1,
        },
      ],
    });
    expect(applyTwinIntegrityRepairsForTenantMock).toHaveBeenCalledWith("t1", { maxActions: 50 });
    expect(appendTwinMutationAuditEventMock).toHaveBeenCalledWith({
      tenantId: "t1",
      actorId: "u1",
      action: "integrity_repair_apply_executed",
      metadata: {
        attemptedActionCount: 1,
        appliedActionCount: 1,
      },
    });
  });

  it("returns 403 when maintenance admin grant is missing", async () => {
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

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/integrity/repair-apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmApply: true }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden: Supply Chain Twin maintenance routes require org.settings edit permission.",
      code: "FORBIDDEN",
    });
    expect(applyTwinIntegrityRepairsForTenantMock).not.toHaveBeenCalled();
  });
});
