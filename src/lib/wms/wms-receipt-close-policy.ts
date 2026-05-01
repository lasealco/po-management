import type { WmsReceiveStatus } from "@prisma/client";

import { canTransitionWmsReceive } from "@/lib/wms/wms-receive-status";

/** BF-21 — `close_wms_receipt` may advance Option A status to RECEIPT_COMPLETE when operator opts in. */
export function canAdvanceReceiveStatusToReceiptComplete(from: WmsReceiveStatus): boolean {
  return canTransitionWmsReceive(from, "RECEIPT_COMPLETE");
}
