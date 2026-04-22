import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findFirstPo: vi.fn(),
  findFirstSo: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesOrder: { findFirst: h.findFirstSo },
    purchaseOrder: { findFirst: h.findFirstPo },
  },
}));

import {
  dryRunPurchaseOrderBuyerReferenceConflicts,
  dryRunSalesOrderExternalRefConflicts,
} from "./downstream-mapped-rows-apply";

describe("downstream mapped rows — dry-run duplicate checks", () => {
  beforeEach(() => {
    h.findFirstSo.mockReset();
    h.findFirstPo.mockReset();
  });

  it("dryRunSalesOrderExternalRefConflicts returns first conflicting row", async () => {
    h.findFirstSo.mockResolvedValueOnce({ id: "so-1" });
    const out = await dryRunSalesOrderExternalRefConflicts("t1", [
      { rowIndex: 0, mappedRecord: { externalRef: "X-1", customerCrmAccountId: "a" } },
    ]);
    expect(out).toEqual({ rowIndex: 0, externalRef: "X-1" });
  });

  it("dryRunPurchaseOrderBuyerReferenceConflicts returns first conflicting row", async () => {
    h.findFirstPo.mockResolvedValueOnce({ id: "po-1" });
    const out = await dryRunPurchaseOrderBuyerReferenceConflicts("t1", [
      { rowIndex: 2, mappedRecord: { buyerReference: "REQ-9", supplierId: "s", productId: "p", quantity: 1, unitPrice: 1 } },
    ]);
    expect(out).toEqual({ rowIndex: 2, buyerReference: "REQ-9" });
  });

  it("dryRunPurchaseOrderBuyerReferenceConflicts skips rows without buyerReference", async () => {
    const out = await dryRunPurchaseOrderBuyerReferenceConflicts("t1", [
      { rowIndex: 0, mappedRecord: { supplierId: "s", productId: "p", quantity: 1, unitPrice: 1 } },
    ]);
    expect(out).toBeNull();
    expect(h.findFirstPo).not.toHaveBeenCalled();
  });
});
