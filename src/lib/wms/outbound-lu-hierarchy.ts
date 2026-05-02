import { verifyGs1Mod10CheckDigit } from "@/lib/wms/gs1-sscc";

/** Rows for BF-57 hierarchy / SSCC validation (typically from `WmsOutboundLogisticsUnit`). */
export type OutboundLuHierarchyInput = {
  id: string;
  parentUnitId: string | null;
  scanCode: string;
  outboundOrderLineId?: string | null;
  containedQty?: string | null;
};

export type OutboundLuHierarchyValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  ssccFailures: Array<{ id: string; scanCode: string; reason: string }>;
};

function shortId(id: string): string {
  return id.length <= 10 ? id : `${id.slice(0, 8)}…`;
}

/**
 * Validates parent references, SSCC-18 check digits (18-digit scan codes only), and acyclic parent edges.
 * Non-numeric or non-18-digit scan codes are treated as opaque LPN tokens (no GS1 check).
 */
export function validateOutboundLuHierarchy(input: OutboundLuHierarchyInput[]): OutboundLuHierarchyValidation {
  const byId = new Map(input.map((r) => [r.id, r]));
  const errors: string[] = [];
  const warnings: string[] = [];
  const ssccFailures: Array<{ id: string; scanCode: string; reason: string }> = [];
  const seenCycleSigs = new Set<string>();

  for (const u of input) {
    if (u.parentUnitId && !byId.has(u.parentUnitId)) {
      errors.push(`Logistics unit ${shortId(u.id)}: parentUnitId references a unit not on this outbound.`);
    }
    if (/^\d{18}$/.test(u.scanCode)) {
      if (!verifyGs1Mod10CheckDigit(u.scanCode)) {
        ssccFailures.push({
          id: u.id,
          scanCode: u.scanCode,
          reason: "SSCC-18 Mod-10 check digit invalid",
        });
        errors.push(`SSCC-18 check digit failed for unit ${shortId(u.id)} (scan ${u.scanCode}).`);
      }
    }
    if (u.outboundOrderLineId) {
      const q =
        u.containedQty == null || u.containedQty === ""
          ? NaN
          : Number(String(u.containedQty).trim());
      if (!Number.isFinite(q) || q <= 0) {
        warnings.push(
          `Unit ${shortId(u.id)}: line-bound logistics unit should use a positive containedQty for pack/ship substitution.`,
        );
      }
    }
  }

  for (const start of input) {
    const path: string[] = [];
    let cur: string | null = start.id;
    while (cur) {
      const loopAt = path.indexOf(cur);
      if (loopAt >= 0) {
        const loopNodes = path.slice(loopAt).concat(cur);
        const sig = [...new Set(loopNodes)].sort().join("|");
        if (!seenCycleSigs.has(sig)) {
          seenCycleSigs.add(sig);
          errors.push(`Hierarchy cycle: ${loopNodes.join(" → ")}`);
        }
        break;
      }
      path.push(cur);
      const row = byId.get(cur);
      cur = row?.parentUnitId ?? null;
    }
  }

  return { ok: errors.length === 0, errors, warnings, ssccFailures };
}
