/**
 * BF-48 — manifest-driven inventory mutation matrix (extends BF-16 lot-only split).
 * Edit `wms-field-acl-matrix.json`; server gates read {@link evaluateWmsInventoryPostMutationAccess}.
 */

import rawMatrix from "./wms-field-acl-matrix.json";

export type WmsFieldAclMatrix = {
  version: number;
  inventory: {
    lotMetadataOnly: string[];
    serialRegistryOnly: string[];
  };
};

export type WmsInventoryAclKind = "lot_metadata" | "serial_registry" | "full_inventory";

let cached: WmsFieldAclMatrix | null = null;

function assertMatrix(m: unknown): asserts m is WmsFieldAclMatrix {
  if (!m || typeof m !== "object") throw new Error("wms_field_acl_matrix: invalid root");
  const o = m as Record<string, unknown>;
  if (typeof o.version !== "number" || o.version < 1) {
    throw new Error("wms_field_acl_matrix: version must be >= 1");
  }
  const inv = o.inventory;
  if (!inv || typeof inv !== "object") throw new Error("wms_field_acl_matrix: inventory missing");
  const invO = inv as Record<string, unknown>;
  if (!Array.isArray(invO.lotMetadataOnly) || !invO.lotMetadataOnly.every((x) => typeof x === "string")) {
    throw new Error("wms_field_acl_matrix: inventory.lotMetadataOnly must be string[]");
  }
  if (
    !Array.isArray(invO.serialRegistryOnly) ||
    !invO.serialRegistryOnly.every((x) => typeof x === "string")
  ) {
    throw new Error("wms_field_acl_matrix: inventory.serialRegistryOnly must be string[]");
  }
}

/** Loads and validates the matrix once per process (Vitest workers each cache independently). */
export function loadWmsFieldAclMatrix(): WmsFieldAclMatrix {
  if (cached) return cached;
  assertMatrix(rawMatrix);
  cached = rawMatrix as WmsFieldAclMatrix;
  return cached;
}

/** For tests / diagnostics — stable structural snapshot without relying on import identity. */
export function getWmsFieldAclMatrixSnapshot(): {
  version: number;
  inventory: { lotMetadataOnly: string[]; serialRegistryOnly: string[] };
} {
  const m = loadWmsFieldAclMatrix();
  return {
    version: m.version,
    inventory: {
      lotMetadataOnly: [...m.inventory.lotMetadataOnly].sort(),
      serialRegistryOnly: [...m.inventory.serialRegistryOnly].sort(),
    },
  };
}

export function inventoryAclKindForAction(action: string): WmsInventoryAclKind {
  const m = loadWmsFieldAclMatrix();
  if (m.inventory.lotMetadataOnly.includes(action)) return "lot_metadata";
  if (m.inventory.serialRegistryOnly.includes(action)) return "serial_registry";
  return "full_inventory";
}
