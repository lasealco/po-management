import { SupplierApprovalStatus, SrmSupplierCategory } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { mapSupplierMasterUpsertToSupplierFields } from "@/lib/srm/srm-supplier-master-upsert-map";
import { parseSupplierMasterUpsertPayload } from "@/lib/srm/srm-supplier-master-upsert-payload";

describe("mapSupplierMasterUpsertToSupplierFields", () => {
  it("maps code-only payload to match key + omits optional columns", () => {
    const parsed = parseSupplierMasterUpsertPayload({ supplier_code: "EXT-001" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const m = mapSupplierMasterUpsertToSupplierFields(parsed.data);
    expect(m).toEqual({ code: "EXT-001" });
  });

  it("maps full payload including category and status", () => {
    const parsed = parseSupplierMasterUpsertPayload({
      supplier_code: "EXT-002",
      legal_name: "Globex BV",
      country: "BE",
      category: "logistics",
      status: "pending_approval",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const m = mapSupplierMasterUpsertToSupplierFields(parsed.data);
    expect(m).toEqual({
      code: "EXT-002",
      legalName: "Globex BV",
      registeredCountryCode: "BE",
      srmCategory: SrmSupplierCategory.logistics,
      isActive: false,
      approvalStatus: SupplierApprovalStatus.pending_approval,
    });
  });

  it("maps suspended to inactive approved supplier (operational pause)", () => {
    const parsed = parseSupplierMasterUpsertPayload({
      supplier_code: "EXT-003",
      status: "suspended",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const m = mapSupplierMasterUpsertToSupplierFields(parsed.data);
    expect(m.isActive).toBe(false);
    expect(m.approvalStatus).toBe(SupplierApprovalStatus.approved);
  });

  it("end-to-end parse then map for active", () => {
    const parsed = parseSupplierMasterUpsertPayload({
      supplier_code: "EXT-004",
      status: "active",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(mapSupplierMasterUpsertToSupplierFields(parsed.data)).toMatchObject({
      code: "EXT-004",
      isActive: true,
      approvalStatus: SupplierApprovalStatus.approved,
    });
  });
});
