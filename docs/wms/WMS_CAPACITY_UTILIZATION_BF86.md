# BF-86 — Capacity utilization snapshot JSON

**Objective:** Bin-level advisory snapshot combining **inventory occupancy hints**, optional **cube utilization** against **`WarehouseBin.capacityCubeCubicMm`** (**BF-33**), and **pick velocity** from ledger **`PICK`** rows (**BF-52** methodology sibling).

## Endpoint

**`GET /api/wms/capacity-utilization-snapshot`** — JSON **`bf86.v1`** (`schemaVersion`).

Requires **`org.wms` → view**. Honors **`loadWmsViewReadScope`** product-division filter on **`InventoryBalance`** / **`InventoryMovement`** aggregates.

### Query parameters

| Param | Meaning |
|-------|---------|
| **`warehouseId`** or **`wh`** | Required warehouse id |
| **`days`** / **`windowDays`** | Pick velocity window (1–365, default **30**) |
| **`limitBins`** / **`limit`** | Max bins returned after sort (1–500, default **200**) |
| **`sort`** | **`velocity_desc`** (default) or **`utilization`** / **`utilization_desc`** — utilization prefers **`cubeUtilizationRatio`** then velocity |

### Payload (summary)

- **`bins[]`**: `balanceRowCount`, `onHandQtyTotal`, `allocatedQtyTotal`, **`pickVelocityUnits`** (sum **|**qty**|** on **`PICK`** movements with **`binId`** in window), **`estimatedOccupiedCubeMm`** (sum of carton-based estimates where **`Product`** carton dims + **`cartonUnitsPerMasterCarton`** exist), **`cubeUtilizationRatio`** when **`capacityCubeCubicMm`** and estimate exist.
- **`velocityHeatScore`**: 0–100 within the **returned cohort** vs max pick velocity in that cohort (not global warehouse rank).
- **`warnings`**: e.g. bins missing **`capacityCubeCubicMm`**.

## Out of scope

Heatmap GIS tiles, bin geometry beyond optional cube hints, labor standards (**BF-53**).

See **BF-52** — [`WMS_SLOTTING_BF52.md`](./WMS_SLOTTING_BF52.md).
