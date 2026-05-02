# BF-50 — Topology graph export & twin-readiness

**Goal:** Export a **JSON graph** (nodes + edges) describing **`WarehouseAisle`** masters and **`WarehouseBin`** layout hints so simulation / digital-twin vendors can ingest topology **without** AGV runtime or Unity/Unreal adapters in-product.

## Surfaces

- **`GET /api/wms?topologyGraph=1&warehouseId=<id>`** (also accepts **`wh`**) — **`org.wms` → view** only; returns **`WarehouseTopologyGraph`**.
- **`POST /api/wms`** with **`action: "export_warehouse_topology_graph"`** + **`warehouseId`** — **`org.wms.setup` → edit** (or legacy full WMS edit); same JSON body as GET.

## Payload (`schemaVersion` **`bf50.v1`**)

- **`warehouse`** — id, code, name.
- **`nodes`** — prefixed ids **`aisle:{rowId}`**, **`bin:{rowId}`**; **`hints`** carry mm geometry on aisles (`lengthMm`, `origin*Mm`, …) and rack addressing on bins (`rackCode`, `level`, `positionIndex`, `capacityCubeCubicMm`, …).
- **`edges`**
  - **`BIN_IN_AISLE`** — bin → aisle when **`warehouseAisleId`** is set.
  - **`ADJACENT_SLOT`** — heuristic adjacency: same aisle FK + **`rackCode`** + bay + level; consecutive **`positionIndex`** (active bins only).

## Implementation

- **`src/lib/wms/warehouse-topology-graph.ts`** (+ Vitest).
- **Setup UI** — **Current layout** panel: **Download topology JSON** (`wms-client.tsx`).

## Out of scope

Live AGV orchestration, Unity/Unreal twin runtime, authenticated partner webhook export.
