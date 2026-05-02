/**
 * BF-50 — warehouse topology JSON for twin / simulation handoff (aisles + bins + heuristic adjacency).
 */

import { prisma } from "@/lib/prisma";

export const WAREHOUSE_TOPOLOGY_SCHEMA_VERSION = "bf50.v1" as const;

export type WarehouseTopologyNodeKind = "aisle" | "bin";

export type WarehouseTopologyEdgeKind = "BIN_IN_AISLE" | "ADJACENT_SLOT";

export type WarehouseTopologyNode = {
  id: string;
  kind: WarehouseTopologyNodeKind;
  label: string;
  warehouseId: string;
  isActive: boolean;
  hints: Record<string, unknown>;
};

export type WarehouseTopologyEdge = {
  id: string;
  kind: WarehouseTopologyEdgeKind;
  source: string;
  target: string;
  meta?: Record<string, unknown>;
};

export type WarehouseTopologyGraph = {
  schemaVersion: typeof WAREHOUSE_TOPOLOGY_SCHEMA_VERSION;
  warehouse: { id: string; code: string; name: string };
  generatedAt: string;
  stats: {
    nodeCount: number;
    edgeCount: number;
    aisleNodes: number;
    binNodes: number;
    binInAisleEdges: number;
    adjacentSlotEdges: number;
  };
  nodes: WarehouseTopologyNode[];
  edges: WarehouseTopologyEdge[];
};

export type BinTopoAdjacencyInput = {
  id: string;
  warehouseAisleId: string | null;
  rackCode: string | null;
  bay: string | null;
  level: number | null;
  positionIndex: number | null;
  isActive: boolean;
};

export function normalizeTopologyBayKey(bay: string | null | undefined): string {
  return bay?.trim() ?? "";
}

/** Heuristic: consecutive positionIndex within same aisle master + rack + bay + level (active bins only). */
export function computeAdjacentSlotEdges(bins: BinTopoAdjacencyInput[]): WarehouseTopologyEdge[] {
  const eligible = bins.filter(
    (b) =>
      b.isActive &&
      b.warehouseAisleId &&
      b.rackCode?.trim() &&
      b.level != null &&
      Number.isFinite(b.level) &&
      b.positionIndex != null &&
      Number.isFinite(b.positionIndex),
  );

  const groups = new Map<string, BinTopoAdjacencyInput[]>();
  for (const b of eligible) {
    const rack = b.rackCode!.trim();
    const key = `${b.warehouseAisleId}|${rack}|${normalizeTopologyBayKey(b.bay)}|${b.level}`;
    const list = groups.get(key);
    if (list) list.push(b);
    else groups.set(key, [b]);
  }

  const edges: WarehouseTopologyEdge[] = [];
  const seenPair = new Set<string>();

  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => (a.positionIndex! - b.positionIndex!) || a.id.localeCompare(b.id));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const c = sorted[i + 1]!;
      if (c.positionIndex! - a.positionIndex! !== 1) continue;
      const [lo, hi] = a.id < c.id ? [a.id, c.id] : [c.id, a.id];
      const pairKey = `${lo}\0${hi}`;
      if (seenPair.has(pairKey)) continue;
      seenPair.add(pairKey);
      edges.push({
        id: `ADJ_SLOT:${lo}:${hi}`,
        kind: "ADJACENT_SLOT",
        source: lo,
        target: hi,
        meta: {
          warehouseAisleId: a.warehouseAisleId,
          rackCode: a.rackCode?.trim(),
          bay: normalizeTopologyBayKey(a.bay),
          level: a.level,
        },
      });
    }
  }

  return edges;
}

export function buildWarehouseTopologyGraph(params: {
  warehouse: { id: string; code: string; name: string };
  aisles: Array<{
    id: string;
    code: string;
    name: string;
    zoneId: string | null;
    isActive: boolean;
    lengthMm: number | null;
    widthMm: number | null;
    originXMm: number | null;
    originYMm: number | null;
    originZMm: number | null;
  }>;
  bins: Array<{
    id: string;
    code: string;
    name: string;
    zoneId: string | null;
    warehouseAisleId: string | null;
    rackCode: string | null;
    aisle: string | null;
    bay: string | null;
    level: number | null;
    positionIndex: number | null;
    capacityCubeCubicMm: number | null;
    isPickFace: boolean;
    isCrossDockStaging: boolean;
    isActive: boolean;
    storageType: string;
  }>;
  generatedAt?: Date;
}): WarehouseTopologyGraph {
  const { warehouse, aisles, bins, generatedAt = new Date() } = params;

  const nodes: WarehouseTopologyNode[] = [];

  for (const a of aisles) {
    nodes.push({
      id: `aisle:${a.id}`,
      kind: "aisle",
      label: a.code,
      warehouseId: warehouse.id,
      isActive: a.isActive,
      hints: {
        aisleRowId: a.id,
        name: a.name,
        zoneId: a.zoneId,
        lengthMm: a.lengthMm,
        widthMm: a.widthMm,
        originXMm: a.originXMm,
        originYMm: a.originYMm,
        originZMm: a.originZMm,
      },
    });
  }

  for (const b of bins) {
    nodes.push({
      id: `bin:${b.id}`,
      kind: "bin",
      label: b.code,
      warehouseId: warehouse.id,
      isActive: b.isActive,
      hints: {
        binRowId: b.id,
        name: b.name,
        zoneId: b.zoneId,
        warehouseAisleId: b.warehouseAisleId,
        rackCode: b.rackCode,
        aisleText: b.aisle,
        bay: b.bay,
        level: b.level,
        positionIndex: b.positionIndex,
        capacityCubeCubicMm: b.capacityCubeCubicMm,
        isPickFace: b.isPickFace,
        isCrossDockStaging: b.isCrossDockStaging,
        storageType: b.storageType,
      },
    });
  }

  const edges: WarehouseTopologyEdge[] = [];

  for (const b of bins) {
    if (!b.warehouseAisleId) continue;
    edges.push({
      id: `BIN_IN_AISLE:${b.id}`,
      kind: "BIN_IN_AISLE",
      source: `bin:${b.id}`,
      target: `aisle:${b.warehouseAisleId}`,
    });
  }

  const adjacencyInputs: BinTopoAdjacencyInput[] = bins.map((b) => ({
    id: `bin:${b.id}`,
    warehouseAisleId: b.warehouseAisleId,
    rackCode: b.rackCode,
    bay: b.bay,
    level: b.level,
    positionIndex: b.positionIndex,
    isActive: b.isActive,
  }));

  edges.push(...computeAdjacentSlotEdges(adjacencyInputs));

  const aisleNodes = nodes.filter((n) => n.kind === "aisle").length;
  const binNodes = nodes.filter((n) => n.kind === "bin").length;
  const binInAisleEdges = edges.filter((e) => e.kind === "BIN_IN_AISLE").length;
  const adjacentSlotEdges = edges.filter((e) => e.kind === "ADJACENT_SLOT").length;

  return {
    schemaVersion: WAREHOUSE_TOPOLOGY_SCHEMA_VERSION,
    warehouse,
    generatedAt: generatedAt.toISOString(),
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      aisleNodes,
      binNodes,
      binInAisleEdges,
      adjacentSlotEdges,
    },
    nodes,
    edges,
  };
}

export async function fetchWarehouseTopologyGraph(params: {
  tenantId: string;
  warehouseId: string;
}): Promise<WarehouseTopologyGraph | null> {
  const { tenantId, warehouseId } = params;

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenantId },
    select: { id: true, code: true, name: true },
  });
  if (!warehouse) return null;

  const warehouseShape = {
    id: warehouse.id,
    code: warehouse.code?.trim() || warehouse.name.trim() || warehouse.id.slice(0, 8),
    name: warehouse.name,
  };

  const [aisles, bins] = await Promise.all([
    prisma.warehouseAisle.findMany({
      where: { tenantId, warehouseId },
      select: {
        id: true,
        code: true,
        name: true,
        zoneId: true,
        isActive: true,
        lengthMm: true,
        widthMm: true,
        originXMm: true,
        originYMm: true,
        originZMm: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.warehouseBin.findMany({
      where: { tenantId, warehouseId },
      select: {
        id: true,
        code: true,
        name: true,
        zoneId: true,
        warehouseAisleId: true,
        rackCode: true,
        aisle: true,
        bay: true,
        level: true,
        positionIndex: true,
        capacityCubeCubicMm: true,
        isPickFace: true,
        isCrossDockStaging: true,
        isActive: true,
        storageType: true,
      },
      orderBy: { code: "asc" },
    }),
  ]);

  return buildWarehouseTopologyGraph({
    warehouse: warehouseShape,
    aisles,
    bins,
  });
}