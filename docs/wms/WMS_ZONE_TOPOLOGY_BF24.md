# BF-24 — First-class aisle / geometry hooks (minimal shipped)

**Capsule:** topology depth beyond bin text-only **`aisle`** labels — see [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-24, catalog [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md).

## What shipped

| Piece | Detail |
|-------|--------|
| Schema | **`WarehouseAisle`** per warehouse (`code`, `name`, optional **`zoneId`** hint, optional **`lengthMm` / `widthMm` / `originXMm` / `originYMm` / `originZMm`**, **`isActive`**). |
| Bin link | Nullable **`WarehouseBin.warehouseAisleId`** FK; free-text **`WarehouseBin.aisle`** must match master **`code`** (case-insensitive) when linked. |
| POST | **`create_warehouse_aisle`**, **`update_warehouse_aisle`** (`org.wms.setup` tier). Body fields: **`primaryZoneId`**, **`lengthMm`** … **`originZMm`**, **`isActive`** on patch. |
| Bin writes | **`create_bin`** / **`update_bin_profile`** accept **`warehouseAisleId`**; server normalizes **`aisle`** text from master when linked. |
| GET | **`GET /api/wms`** exposes **`aisles`** plus **`warehouseAisleId`** / **`warehouseAisle`** on bins. |
| UI | WMS Setup — create aisle, list + deactivate/reactivate, optional bin **aisle master** picker. |
| Tests | Vitest **`warehouse-aisle.test.ts`** (`resolveBinAisleFieldsForWrite`, **`parseMmForWrite`**). |

## Methodology

1. **Master record** identifies the corridor (`code`); bins either stay free-text only or opt into the FK for reporting consistency.
2. **Validation** prevents drift: linked bins cannot carry a different **`aisle`** label than the master **`code`**.
3. **Millimetre fields** are optional layout hints for future slotting / map work — not a constraint solver input.

## Explicit backlog

- Digital twin meshes, AGV routing graphs, aisle↔aisle adjacency.
- Indoor CT map tiles (**BF-27**).

## References

- [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md) — WE-10 decision + BF-24 amendment.

_Last updated: 2026-05-04._
