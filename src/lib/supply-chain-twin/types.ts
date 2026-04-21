/**
 * Minimal twin graph primitives; extend with `docs/sctwin/supply_chain_twin_data_model_and_graph_spec.md`.
 */

/** Known node kinds (open set for forward-compatible payloads). */
export const TWIN_ENTITY_KINDS = [
  "supplier",
  "site",
  "purchase_order",
  "shipment",
  "sku",
  "warehouse",
  "unknown",
] as const;

export type TwinEntityKind = (typeof TWIN_ENTITY_KINDS)[number];

export type TwinEntityRef = {
  kind: TwinEntityKind;
  /** Stable tenant-scoped identifier (format defined by persistence layer). */
  id: string;
};

export type TwinEdge = {
  from: TwinEntityRef;
  to: TwinEntityRef;
  /** Optional semantic label, e.g. fulfills, ships, located_at. */
  relation?: string;
};
