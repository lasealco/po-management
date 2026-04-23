import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadSupplierDetailSnapshot } from "./load-supplier-detail-snapshot";

function prismaWithSupplierFindFirst(findFirst: ReturnType<typeof vi.fn>) {
  return {
    supplier: { findFirst },
    supplierOnboardingTask: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  } as unknown as PrismaClient;
}

function baseSupplierRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sup1",
    updatedAt: new Date("2024-06-01T10:00:00.000Z"),
    name: "Acme",
    code: "ACM",
    email: "a@acme.test",
    phone: null,
    isActive: true,
    srmCategory: "product",
    approvalStatus: "approved",
    legalName: "Acme LLC",
    taxId: null,
    website: null,
    registeredAddressLine1: null,
    registeredAddressLine2: null,
    registeredCity: null,
    registeredRegion: null,
    registeredPostalCode: null,
    registeredCountryCode: null,
    paymentTermsDays: 30,
    paymentTermsLabel: "Net 30",
    creditLimit: null,
    creditCurrency: null,
    defaultIncoterm: "FOB",
    internalNotes: null,
    bookingConfirmationSlaHours: null,
    srmOnboardingStage: "intake",
    contacts: [
      {
        id: "ct1",
        name: "Pat",
        title: null,
        role: "Sales",
        email: "pat@acme.test",
        phone: null,
        notes: null,
        isPrimary: true,
      },
    ],
    offices: [
      { id: "of1", name: "HQ", city: "Berlin", countryCode: "DE", isActive: true },
    ],
    serviceCapabilities: [
      {
        id: "cap1",
        mode: "OCEAN",
        subMode: null,
        serviceType: "Freight forwarding",
        geography: "EU",
        notes: null,
      },
    ],
    _count: { productSuppliers: 3, orders: 12 },
    ...overrides,
  };
}

describe("loadSupplierDetailSnapshot", () => {
  const findFirst = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when supplier is not in tenant scope", async () => {
    findFirst.mockResolvedValue(null);
    const r = await loadSupplierDetailSnapshot(prismaWithSupplierFindFirst(findFirst), "t1", "missing");
    expect(r).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "missing", tenantId: "t1" },
      }),
    );
  });

  it("maps logistics category, pending approval, and credit limit decimal", async () => {
    findFirst.mockResolvedValue(
      baseSupplierRow({
        srmCategory: "logistics",
        approvalStatus: "pending_approval",
        creditLimit: { toString: () => "1500.25" },
        creditCurrency: "EUR",
      }),
    );
    const r = await loadSupplierDetailSnapshot(prismaWithSupplierFindFirst(findFirst), "t1", "sup1");
    expect(r).not.toBeNull();
    expect(r!.srmCategory).toBe("logistics");
    expect(r!.approvalStatus).toBe("pending_approval");
    expect(r!.creditLimit).toBe("1500.25");
    expect(r!.capabilities).toEqual([
      {
        id: "cap1",
        mode: "OCEAN",
        subMode: null,
        serviceType: "Freight forwarding",
        geography: "EU",
        notes: null,
      },
    ]);
    expect(r!.productLinkCount).toBe(3);
    expect(r!.orderCount).toBe(12);
    expect(r!.updatedAt).toBe("2024-06-01T10:00:00.000Z");
    expect(r!.bookingConfirmationSlaHours).toBeNull();
    expect(r!.srmOnboardingStage).toBe("intake");
  });

  it("maps rejected approval and defaults non-logistics category to product", async () => {
    findFirst.mockResolvedValue(
      baseSupplierRow({
        srmCategory: "product",
        approvalStatus: "rejected",
      }),
    );
    const r = await loadSupplierDetailSnapshot(prismaWithSupplierFindFirst(findFirst), "t1", "sup1");
    expect(r!.approvalStatus).toBe("rejected");
    expect(r!.srmCategory).toBe("product");
  });

});
