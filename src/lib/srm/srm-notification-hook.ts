/**
 * Placeholder for org-wide SRM notifications (email, in-app, webhooks).
 * Phase B slice 15: structured log until a real notification bus exists.
 */
export function srmNotificationHook(payload: {
  kind: "SUPPLIER_APPROVAL_DECISION" | "SUPPLIER_SUBMITTED_PENDING";
  tenantId: string;
  supplierId: string;
  supplierName: string;
  decision?: "approve" | "reject" | "reopen";
  approvalStatus: string;
  actorUserId: string;
}) {
  console.log(
    JSON.stringify({
      module: "srm",
      channel: "notification_hook",
      ...payload,
    }),
  );
}
