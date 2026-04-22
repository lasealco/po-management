import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const guardInvoiceAuditSchemaMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/app/api/invoice-audit/_lib/guard-invoice-audit-schema", () => ({
  guardInvoiceAuditSchema: guardInvoiceAuditSchemaMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookingPricingSnapshot: {
      findMany: findManyMock,
    },
  },
}));

describe("Invoice pricing-snapshot-options route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    guardInvoiceAuditSchemaMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
  });

  it("returns 404 parity body when tenant missing", async () => {
    getDemoTenantMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Tenant not found.", code: "NOT_FOUND" });
  });

  it("returns snapshots with totalEstimatedCost serialized as string", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "snap-1",
        sourceType: "RFQ",
        sourceSummary: "Summary",
        currency: "USD",
        totalEstimatedCost: 1500.25,
        frozenAt: new Date("2026-04-20T00:00:00.000Z"),
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      snapshots: [
        expect.objectContaining({
          id: "snap-1",
          totalEstimatedCost: "1500.25",
        }),
      ],
    });
  });
});
