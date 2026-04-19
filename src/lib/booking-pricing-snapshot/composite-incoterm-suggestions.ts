/**
 * Non-authoritative hints for which component roles often appear with a given Incoterm.
 * Users still choose contract versions at freeze time; this only guides the form.
 */
export function compositeIncotermRoleHints(incotermRaw: string): string | null {
  const t = incotermRaw.trim().toUpperCase();
  if (!t) return null;

  const hints: Record<string, string> = {
    EXW: "Typical legs: FORWARDER_HANDLING, PRE_CARRIAGE, MAIN_OCEAN or MAIN_AIR (buyer may arrange main carriage separately).",
    FCA: "Typical legs: FORWARDER_HANDLING, PRE_CARRIAGE up to handover; MAIN_OCEAN / MAIN_AIR if you price them together.",
    FAS: "Typical legs: FORWARDER_HANDLING, PRE_CARRIAGE, port-side charges before vessel; MAIN_OCEAN if you include ocean in the same snapshot.",
    FOB: "Typical legs: FORWARDER_HANDLING, PRE_CARRIAGE, origin THC-style charges; ocean is often excluded if the carrier bills the counterparty separately.",
    CFR: "Typical legs: MAIN_OCEAN (or MAIN_AIR) plus common surcharges you control; destination landside often excluded.",
    CIF: "Typical legs: MAIN_OCEAN + insurance-type charges if modeled; align with who buys insurance in your contracts.",
    CPT: "Typical legs: PRE_CARRIAGE / MAIN modes through named place; add DESTINATION_HANDLING if you price delivery.",
    CIP: "Typical legs: similar to CPT; add coverage-related charges if you model them as lines.",
    DAP: "Typical legs: MAIN_OCEAN, ON_CARRIAGE, DESTINATION_HANDLING up to named place.",
    DPU: "Typical legs: MAIN_OCEAN, ON_CARRIAGE, unloading at destination.",
    DDP: "Typical legs: MAIN_OCEAN, ON_CARRIAGE, DESTINATION_HANDLING, CUSTOMS_CLEARANCE-style charges if applicable.",
  };

  return hints[t] ?? null;
}

/** Short role tokens to prefill composite snapshot rows (version ids stay blank for you to paste). */
export function suggestedCompositeRolesFromIncoterm(incotermRaw: string): string[] {
  const t = incotermRaw.trim().toUpperCase();
  const map: Record<string, string[]> = {
    EXW: ["FORWARDER_HANDLING", "PRE_CARRIAGE", "MAIN_OCEAN"],
    FCA: ["FORWARDER_HANDLING", "PRE_CARRIAGE", "MAIN_OCEAN"],
    FAS: ["FORWARDER_HANDLING", "PRE_CARRIAGE", "MAIN_OCEAN"],
    FOB: ["FORWARDER_HANDLING", "PRE_CARRIAGE"],
    CFR: ["MAIN_OCEAN"],
    CIF: ["MAIN_OCEAN"],
    CPT: ["PRE_CARRIAGE", "MAIN_OCEAN", "DESTINATION_HANDLING"],
    CIP: ["PRE_CARRIAGE", "MAIN_OCEAN", "DESTINATION_HANDLING"],
    DAP: ["MAIN_OCEAN", "ON_CARRIAGE", "DESTINATION_HANDLING"],
    DPU: ["MAIN_OCEAN", "ON_CARRIAGE"],
    DDP: ["MAIN_OCEAN", "ON_CARRIAGE", "DESTINATION_HANDLING", "CUSTOMS_CLEARANCE"],
  };
  return map[t] ?? [];
}
