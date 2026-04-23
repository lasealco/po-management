import { describe, expect, it } from "vitest";

import { redactSupplierDetailSnapshot, redactSupplierRecordForView } from "@/lib/srm/redact-supplier-sensitive";
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
    const r = redactSupplierDetailSnapshot(
      {
        ...base,
        legalName: "LegCo",
        email: "co@x.com",
        phone: "+1",
        registeredAddressLine1: "1 St",
        paymentTermsDays: 30,
        defaultIncoterm: "FOB",
        capabilities: [
          {
            id: "cap1",
            mode: "OCEAN",
            subMode: null,
            serviceType: "FF",
            geography: "EU",
            notes: "sec cap",
          },
        ],
        offices: [
          { id: "o1", name: "WH", city: "Berlin", countryCode: "DE", isActive: true },
        ],
        contacts: [
          {
            ...base.contacts[0],
            email: "p@x.com",
            phone: "555",
          },
        ],
      },
      false,
    );
    expect(r.legalName).toBeNull();
    expect(r.email).toBeNull();
    expect(r.phone).toBeNull();
    expect(r.internalNotes).toBeNull();
    expect(r.taxId).toBeNull();
    expect(r.registeredAddressLine1).toBeNull();
    expect(r.paymentTermsDays).toBeNull();
    expect(r.defaultIncoterm).toBeNull();
    expect(r.creditLimit).toBeNull();
    expect(r.creditCurrency).toBeNull();
    expect(r.contacts[0].notes).toBeNull();
    expect(r.contacts[0].email).toBeNull();
    expect(r.contacts[0].phone).toBeNull();
    expect(r.contacts[0].name).toBe("Pat");
    expect(r.offices[0].city).toBeNull();
    expect(r.offices[0].countryCode).toBeNull();
    expect(r.capabilities[0].geography).toBeNull();
    expect(r.capabilities[0].notes).toBeNull();
    expect(r.capabilities[0].serviceType).toBe("FF");
  });
});

describe("redactSupplierRecordForView", () => {
  it("nulls flat sensitive keys when view-only", () => {
    const r = redactSupplierRecordForView(
      { id: "1", name: "A", email: "e@x.com", custom: "keep" },
      false,
    );
    expect(r.email).toBeNull();
    expect(r.name).toBe("A");
    expect(r.custom).toBe("keep");
  });
});
