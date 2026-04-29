# BF-04 — Zone parent hierarchy (minimal topology slice)

**Goal:** Introduce **optional multi-level functional zones** without separate aisle entities or geometry — aligned with [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md) deferred items narrowed for blueprint finish.

## Schema

| Field | Model | Role |
|-------|--------|------|
| `parentZoneId` | `WarehouseZone` | Nullable FK to another `WarehouseZone` in the **same warehouse** (`ON DELETE SET NULL`). |

## Rules

- **DAG only:** API rejects assignments that would create a **cycle** (see `warehouseZoneParentWouldCycle` in `src/lib/wms/zone-hierarchy.ts`).
- **Same warehouse:** Parent must belong to the child’s `warehouseId`.
- **Not shipped:** First-class **`Aisle` table**, mm geometry, 3D twin — still backlog (see ADR).

## API

| Action | Body |
|--------|------|
| `set_zone_parent` | `zoneId` (required), **`parentZoneId`** (required key — use **`null`** in JSON to clear). |

**Audit:** `CtAuditLog` — `entityType` **`WAREHOUSE_ZONE`**, `action` **`zone_parent_updated`**.

## Read model

`GET /api/wms` zones include `parentZoneId` and nested `parentZone` `{ id, code, name }` when set.

## UI

**Setup → Current layout → Zones:** parent dropdown per zone row (same warehouse options excluding self).

## Residual

- **Aisles as entities**, rack geometry beyond bin text fields — still deferred per ADR.
