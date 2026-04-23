import { SupplierApprovalStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  assertSupplierApprovalTransition,
  canTransitionSupplierApprovalStatus,
} from "./supplier-approval-transitions";

describe("supplier approval transitions", () => {
  it("allows identity transitions", () => {
    for (const s of Object.values(SupplierApprovalStatus)) {
      expect(canTransitionSupplierApprovalStatus(s, s)).toBe(true);
      expect(assertSupplierApprovalTransition(s, s).ok).toBe(true);
    }
  });

  it("allows pending → approved/rejected", () => {
    expect(
      canTransitionSupplierApprovalStatus(
        SupplierApprovalStatus.pending_approval,
        SupplierApprovalStatus.approved,
      ),
    ).toBe(true);
    expect(
      canTransitionSupplierApprovalStatus(
        SupplierApprovalStatus.pending_approval,
        SupplierApprovalStatus.rejected,
      ),
    ).toBe(true);
  });

  it("allows rejected → pending or approved", () => {
    expect(
      canTransitionSupplierApprovalStatus(
        SupplierApprovalStatus.rejected,
        SupplierApprovalStatus.pending_approval,
      ),
    ).toBe(true);
    expect(
      canTransitionSupplierApprovalStatus(
        SupplierApprovalStatus.rejected,
        SupplierApprovalStatus.approved,
      ),
    ).toBe(true);
  });

  it("allows approved → rejected only", () => {
    expect(
      canTransitionSupplierApprovalStatus(
        SupplierApprovalStatus.approved,
        SupplierApprovalStatus.rejected,
      ),
    ).toBe(true);
    expect(
      canTransitionSupplierApprovalStatus(
        SupplierApprovalStatus.approved,
        SupplierApprovalStatus.pending_approval,
      ),
    ).toBe(false);
  });

  it("rejects illegal edges with assert", () => {
    const r = assertSupplierApprovalTransition(
      SupplierApprovalStatus.approved,
      SupplierApprovalStatus.pending_approval,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Illegal");
  });
});
