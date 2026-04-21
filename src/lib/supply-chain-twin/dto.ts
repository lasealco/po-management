import type { TwinEntityKind } from "./types";

/**
 * Graph node DTO — minimal provenance aligned with `docs/sctwin/supply_chain_twin_data_model_and_graph_spec.md`
 * (“source-of-truth references”).
 */
export type TwinEntityDto = {
  kind: TwinEntityKind;
  id: string;
  /** Upstream system or module name (e.g. `wms`, `erp`, `manual`). */
  sourceSystem?: string | null;
  /** Opaque pointer within `sourceSystem` (record id, URI fragment, etc.). */
  sourceRef?: string | null;
};

/**
 * Directed edge DTO — same optional provenance for ingestion / audit trails.
 */
export type TwinEdgeDto = {
  from: TwinEntityDto;
  to: TwinEntityDto;
  relation?: string | null;
  sourceSystem?: string | null;
  sourceRef?: string | null;
};
