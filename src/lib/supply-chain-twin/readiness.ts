/**
 * Environment / dependency readiness for the Supply Chain Twin module.
 * Extend with DB or service checks in later slices; keep the JSON shape stable for clients.
 */
export type SupplyChainTwinReadiness = {
  ok: boolean;
  reasons: string[];
};

export function getSupplyChainTwinReadinessSnapshot(): SupplyChainTwinReadiness {
  return { ok: true, reasons: [] };
}
