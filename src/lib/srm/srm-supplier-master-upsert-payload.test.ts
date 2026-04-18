import { describe, expect, it } from "vitest";

import { parseSupplierMasterUpsertPayload } from "@/lib/srm/srm-supplier-master-upsert-payload";

describe("parseSupplierMasterUpsertPayload", () => {
  it("accepts minimal snake_case payload", () => {
    const r = parseSupplierMasterUpsertPayload({ supplier_code: "SUP-001" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toEqual({
      supplierCode: "SUP-001",
      legalName: null,
      entity: null,
      countryCode: null,
      srmCategory: null,
      integrationStatus: null,
    });
  });

  it("accepts supplierCode camelCase alias", () => {
    const r = parseSupplierMasterUpsertPayload({ supplierCode: " ACME " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.supplierCode).toBe("ACME");
  });

  it("parses full integration pack example shape", () => {
    const r = parseSupplierMasterUpsertPayload({
      supplier_code: "SUP-001",
      legal_name: "Acme Holdings Ltd",
      entity: "Acme BV",
      country: "nl",
      category: "Logistics",
      status: "Active",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({
      supplierCode: "SUP-001",
      legalName: "Acme Holdings Ltd",
      entity: "Acme BV",
      countryCode: "NL",
      srmCategory: "logistics",
      integrationStatus: "active",
    });
  });

  it("maps pending to pending_approval", () => {
    const r = parseSupplierMasterUpsertPayload({
      supplier_code: "X",
      status: "pending",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.integrationStatus).toBe("pending_approval");
  });

  it("rejects missing supplier_code", () => {
    const r = parseSupplierMasterUpsertPayload({});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/supplier_code is required/i);
  });

  it("rejects invalid country", () => {
    const r = parseSupplierMasterUpsertPayload({
      supplier_code: "X",
      country: "NLD",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/2-letter/i);
  });

  it("rejects unknown category", () => {
    const r = parseSupplierMasterUpsertPayload({
      supplier_code: "X",
      category: "carrier",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/product.*logistics/i);
  });

  it("rejects unknown status", () => {
    const r = parseSupplierMasterUpsertPayload({
      supplier_code: "X",
      status: "ghost",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/status must be one of/i);
  });
});
