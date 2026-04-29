# ADR: WMS zone / site topology scope (WE-10)

## Status

Accepted — 2026-04-29 (Enterprise capsule **WE-10**).

## Context

The blueprint describes richer **site topology**: aisles, bays, levels, sometimes multi-level zone hierarchies or yard networks. The repo already ships **warehouse → zone → bin** with **functional zone typing** (`WarehouseZoneType`) and **dock appointments** (`WmsDockAppointment`) for window-level staging—not full TMS yard automation.

Product asked for **enterprise clarity** on what this codebase models vs what stays deferred.

## Decision

**Shipped topology slice (no schema change required for WE-10):**

| Layer | Representation | Notes |
|-------|----------------|--------|
| Site | `Warehouse` | Tenant-scoped; `CFS` vs `WAREHOUSE` type already on model. |
| Functional areas | `WarehouseZone` | One flat list per warehouse; `zoneType` drives receiving/picking/reserve/etc. |
| Storage addresses | `WarehouseBin` | Optional `zoneId`; **rack addressing** via `rackCode`, `aisle`, `bay`, `level`, `positionIndex`. |
| Operational “edges” | Replenishment rules, dock links | Source/target zones for replenish; appointments tie dock windows to inbound shipments or outbound orders. |

**Interpretation:** “Beyond flat zone+bin” for **this product line** is satisfied by **bin-granular rack coordinates + zone semantics**, surfaced in **Setup** (including rack front map where implemented). Optional **zone→zone parent links** (**BF-04**) provide hierarchy **without** a separate **`Aisle` master table** in this capsule.

**Amendment (BF-04, 2026-04-29):** Optional **`WarehouseZone.parentZoneId`** + **`set_zone_parent`** enable a **DAG** functional hierarchy within a warehouse (cycle-checked). See [`WMS_ZONE_PARENT_BF04.md`](./WMS_ZONE_PARENT_BF04.md).

## Deferred (explicit backlog)

- ~~**Multi-level zone hierarchy**~~ **Partially addressed:** nullable **`parentZoneId`** + **`set_zone_parent`** (**BF-04**); deeper reporting layers remain optional.
- **First-class aisle / tunnel entities** separate from bin text fields.
- **MM-accurate geometry, 3D, or digital twin** meshes.
- **Site-to-site network graphs** as first-class schema (beyond tenant + warehouse list).

These require product prioritization, migration design, and UI ownership—out of WE-10 scope.

## Consequences

- **GAP_MAP** R1 zone row moves toward **🟢** on hierarchy depth once BF-04 is acknowledged in backlog docs; **aisle geometry / twin** stays deferred.
- **`GET /api/wms`** zones expose **`parentZoneId`** / **`parentZone`**; **`POST /api/wms`** **`set_zone_parent`** updates hierarchy.
- Future capsules may add an **`Aisle`** table or geometry **if** directed workflows require it—amend this ADR then.

## References

- [`GAP_MAP.md`](./GAP_MAP.md) — R1 zone row.
- [`ENTERPRISE_TRACK.md`](./ENTERPRISE_TRACK.md) — WE-10 capsule.
