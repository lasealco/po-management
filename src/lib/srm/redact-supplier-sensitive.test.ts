import { describe, expect, it } from "vitest";

import { redactSupplierDetailSnapshot } from "@/lib/srm/redact-supplier-sensitive";
import type { SupplierDetailSnapshot } from "@/components/supplier-detail-client";

const base: SupplierDetailSnapshot = {
  id: "s1",
  updatedAt: new Date().toISOString(),
  name: "Acme",
  code: "A",
  email: null,
  phone: null,
  isActive: true,
  srmCategory: "product",
  approvalStatus: "approved",
  legalName: null,
  taxId: "TAX-1",
  website: null,
  registeredAddressLine1: null,
  registeredAddressLine2: null,
  registeredCity: null,
  registeredRegion: null,
  registeredPostalCode: null,
  registeredCountryCode: null,
  paymentTermsDays: null,
  paymentTermsLabel: null,
  creditLimit: "100",
  creditCurrency: "USD",
  defaultIncoterm: null,
  internalNotes: "sec",
  bookingConfirmationSlaHours: null,
  srmOnboardingStage: "intake",
  contacts: [
    {
      id: "c1",
      name: "Pat",
      title: null,
      role: null,
      email: null,
      phone: null,
      notes: "note1",
      isPrimary: true,
    },
  ],
  offices: [],
  capabilities: [],
  productLinkCount: 0,
  orderCount: 0,
};

describe("redactSupplierDetailSnapshot", () => {
  it("passes through when canViewSensitive", () => {
    expect(redactSupplierDetailSnapshot(base, true)).toEqual(base);
  });

  it("clears sensitive fields when view-only", () => {
    const r = redactSupplierDetailSnapshot(base, false);
    expect(r.internalNotes).toBeNull();
    expect(r.taxId).toBeNull();
    expect(r.creditLimit).toBeNull();
    expect(r.creditCurrency).toBeNull();
    expect(r.contacts[0].notes).toBeNull();
    expect(r.contacts[0].name).toBe("Pat");
  });
});
