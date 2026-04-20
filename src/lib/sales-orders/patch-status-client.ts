import type { SalesOrderStatusTransitionErrorCode } from "./patch-status";

export type SalesOrderPatchStatusErrorPayload = {
  code?: SalesOrderStatusTransitionErrorCode;
  error?: string;
  activeShipments?: Array<{ shipmentNo: string | null; status: string }>;
};

export function buildSalesOrderPatchStatusErrorMessage(
  payload: SalesOrderPatchStatusErrorPayload | null | undefined,
): string {
  if (!payload) return "Could not change status.";

  const base = payload.error || "Could not change status.";
  if (payload.code !== "ACTIVE_SHIPMENTS" || !payload.activeShipments?.length) {
    return base;
  }

  const active = payload.activeShipments
    .map((s) => `${s.shipmentNo || "shipment"} (${s.status})`)
    .join(", ");
  return `${base} Active: ${active}`;
}
