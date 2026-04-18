import type { SnapshotPriceCandidate } from "@/lib/invoice-audit/snapshot-candidates";
import { equipmentMatches } from "@/lib/invoice-audit/ocean-equipment";

export type BasketComponent = {
  kind: string;
  id: string;
  label: string;
  amount: number;
};

/**
 * Separated snapshot basket for an all-in invoice line:
 * — Sum FCL **contract rate** lines for the equipment family (when equipment known).
 * — Add **mandatory, non-included** contract surcharges (BAF/THC/LSS-style) so all-in can be compared to tariff stack.
 */
export function buildContractOceanBasket(params: {
  candidates: SnapshotPriceCandidate[];
  equipmentKey: string | null;
}): { total: number; components: BasketComponent[] } {
  const components: BasketComponent[] = [];
  let total = 0;

  for (const c of params.candidates) {
    if (c.kind === "CONTRACT_RATE") {
      const eq = equipmentMatches(params.equipmentKey, c.equipmentHint);
      if (params.equipmentKey && c.equipmentHint && eq === "MISMATCH") continue;
      components.push({ kind: "CONTRACT_RATE", id: c.id, label: c.label, amount: c.amount });
      total += c.amount;
    }
  }

  const ANCILLARY =
    /\b(baf|caf|lss|pss|thc|ihc|inland haul|haulage|wfg|wharf|gate|war risk|documentation|doc fee|isps|pcs|gri|ecc|ebs|ems|dthc|othc|cfs|vgm|seal|bl fee|bill of lading|handling|pier|los|congestion|surcharge)\b/i;

  for (const c of params.candidates) {
    if (c.kind !== "CONTRACT_CHARGE") continue;
    const inc = c.isIncluded === true;
    const mand = c.isMandatory !== false;
    if (inc || !mand) continue;
    if (!ANCILLARY.test(c.label)) continue;
    const eq = equipmentMatches(params.equipmentKey, c.equipmentHint);
    if (params.equipmentKey && c.equipmentHint && eq === "MISMATCH") continue;
    components.push({ kind: "CONTRACT_CHARGE", id: c.id, label: c.label, amount: c.amount });
    total += c.amount;
  }

  return { total, components };
}

/** RFQ snapshot: use frozen grand total when present, else sum of line amounts. */
export function rfqAllInReferenceTotal(params: {
  candidates: SnapshotPriceCandidate[];
  breakdownGrand: number | null;
}): { total: number; components: BasketComponent[] } {
  if (params.breakdownGrand != null && Number.isFinite(params.breakdownGrand)) {
    return {
      total: params.breakdownGrand,
      components: [{ kind: "RFQ_GRAND", id: "totals.grand", label: "RFQ snapshot grand total", amount: params.breakdownGrand }],
    };
  }
  let t = 0;
  const components: BasketComponent[] = [];
  for (const c of params.candidates) {
    if (c.kind !== "RFQ_LINE") continue;
    t += c.amount;
    components.push({ kind: "RFQ_LINE", id: c.id, label: c.label, amount: c.amount });
  }
  return { total: t, components };
}
