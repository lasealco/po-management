import { SupplierApprovalStatus } from "@prisma/client";

/**
 * Allowed `approvalStatus` moves (SRM Phase B). Documented for reviewers and enforced on API routes.
 *
 * | From              | To                 | Typical surface                          |
 * |-------------------|--------------------|------------------------------------------|
 * | pending_approval  | approved           | POST …/approval `approve`                |
 * | pending_approval  | rejected           | POST …/approval `reject`                 |
 * | rejected          | approved           | POST …/approval `approve` (re-instate)   |
 * | rejected          | pending_approval   | POST …/approval `reopen`                 |
 * | approved          | rejected           | POST …/approval `reject` (revoke)        |
 *
 * Not allowed: `approved` → `pending_approval` directly (revoke to `rejected`, then `reopen` if needed).
 */
const ALLOWED: Record<SupplierApprovalStatus, SupplierApprovalStatus[]> = {
  [SupplierApprovalStatus.pending_approval]: [
    SupplierApprovalStatus.approved,
    SupplierApprovalStatus.rejected,
  ],
  [SupplierApprovalStatus.rejected]: [
    SupplierApprovalStatus.approved,
    SupplierApprovalStatus.pending_approval,
  ],
  [SupplierApprovalStatus.approved]: [SupplierApprovalStatus.rejected],
};

export function canTransitionSupplierApprovalStatus(
  from: SupplierApprovalStatus,
  to: SupplierApprovalStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertSupplierApprovalTransition(
  from: SupplierApprovalStatus,
  to: SupplierApprovalStatus,
): { ok: true } | { ok: false; error: string } {
  if (canTransitionSupplierApprovalStatus(from, to)) return { ok: true };
  return {
    ok: false,
    error: `Illegal approval transition: ${from} → ${to}. See supplier-approval-transitions.ts.`,
  };
}
