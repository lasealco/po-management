import { SupplierApprovalStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { mapSupplierMasterUpsertToSupplierFields } from "@/lib/srm/srm-supplier-master-upsert-map";
import { parseSupplierMasterUpsertPayload } from "@/lib/srm/srm-supplier-master-upsert-payload";

/**
 * Integration-style dry run: inbound JSON → parse → map (no DB, no HTTP).
 * Guards invalid payloads before any mapper runs.
 */
describe("SRM supplier master upsert workflow (parse → map)", () => {
  it("stops on parse failure and does not invoke mapper", () => {
    const parsed = parseSupplierMasterUpsertPayload({});
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toMatch(/supplier_code/i);
  });

  it("maps inactive to approved but not trading", () => {
    const parsed = parseSupplierMasterUpsertPayload({
      supplier_code: "W-INACTIVE",
      status: "inactive",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const m = mapSupplierMasterUpsertToSupplierFields(parsed.data);
    expect(m.isActive).toBe(false);
    expect(m.approvalStatus).toBe(SupplierApprovalStatus.approved);
  });

  it("maps rejected to rejected and inactive", () => {
    const parsed = parseSupplierMasterUpsertPayload({
      supplier_code: "W-REJECT",
      status: "rejected",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const m = mapSupplierMasterUpsertToSupplierFields(parsed.data);
    expect(m.isActive).toBe(false);
    expect(m.approvalStatus).toBe(SupplierApprovalStatus.rejected);
  });

  it("mapped bag is JSON-serializable for queue workers", () => {
    const parsed = parseSupplierMasterUpsertPayload({
      supplier_code: "W-SER",
      legal_name: "Queue Co",
      status: "approved",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const m = mapSupplierMasterUpsertToSupplierFields(parsed.data);
    const round = JSON.parse(JSON.stringify(m)) as typeof m;
    expect(round.code).toBe("W-SER");
    expect(round.approvalStatus).toBe(SupplierApprovalStatus.approved);
    expect(round.legalName).toBe("Queue Co");
  });
});
