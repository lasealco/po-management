/** Version field inside breakdownJson / docs. */
export const PRICING_SNAPSHOT_BREAKDOWN_SCHEMA_VERSION = 2;

/** MVP: sum of all rate line amounts plus all charge line amounts (same-currency assumption). */
export const TOTAL_DERIVATION_SUM_RATE_AND_CHARGES = "SUM_RATE_AND_CHARGE_AMOUNTS";

/** RFQ: prefer stored all-in total when present, else sum line amounts. */
export const TOTAL_DERIVATION_QUOTE_RESPONSE = "QUOTE_RESPONSE_TOTAL_OR_LINE_SUM";
