import type { WmsInboundSubtype, WmsReturnLineDisposition } from "@prisma/client";

/** BF-41 — putaway is blocked for SCRAP return lines (no inventory restock). */
export function customerReturnPutawayBlockedReason(subtype: WmsInboundSubtype, disposition: WmsReturnLineDisposition | null): string | null {
  if (subtype !== "CUSTOMER_RETURN") return null;
  if (disposition === "SCRAP") {
    return "Customer-return line disposition is SCRAP — putaway is not applicable (BF-41).";
  }
  return null;
}

/** BF-41 — after successful putaway into bin, quarantine disposition implies QC hold on balance. */
export function customerReturnApplyQuarantineHold(subtype: WmsInboundSubtype, disposition: WmsReturnLineDisposition | null): boolean {
  return subtype === "CUSTOMER_RETURN" && disposition === "QUARANTINE";
}
