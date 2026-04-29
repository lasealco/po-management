import type { WmsReceiveStatus } from "@prisma/client";

/** Display labels for WMS receiving states (`docs/wms/WMS_RECEIVING_STATE_MACHINE_SPEC.md`). */
export const WMS_RECEIVE_STATUS_LABEL: Record<WmsReceiveStatus, string> = {
  NOT_TRACKED: "Not tracked",
  EXPECTED: "Expected",
  AT_DOCK: "At dock",
  RECEIVING: "Receiving",
  RECEIPT_COMPLETE: "Receipt complete",
  DISCREPANCY: "Discrepancy",
  CLOSED: "Closed",
};

const ALLOWED_FROM: Record<WmsReceiveStatus, readonly WmsReceiveStatus[]> = {
  NOT_TRACKED: ["EXPECTED"],
  EXPECTED: ["AT_DOCK", "DISCREPANCY"],
  AT_DOCK: ["RECEIVING", "DISCREPANCY"],
  RECEIVING: ["RECEIPT_COMPLETE", "DISCREPANCY"],
  DISCREPANCY: ["RECEIVING", "RECEIPT_COMPLETE"],
  RECEIPT_COMPLETE: ["CLOSED"],
  CLOSED: [],
};

export function allowedNextWmsReceiveStatuses(from: WmsReceiveStatus): WmsReceiveStatus[] {
  return [...ALLOWED_FROM[from]];
}

export function canTransitionWmsReceive(from: WmsReceiveStatus, to: WmsReceiveStatus): boolean {
  if (from === to) return false;
  return ALLOWED_FROM[from].includes(to);
}

export function isWmsReceiveStatus(value: string): value is WmsReceiveStatus {
  return Object.keys(ALLOWED_FROM).includes(value);
}
