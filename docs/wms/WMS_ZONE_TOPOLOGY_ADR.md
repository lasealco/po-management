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

**Interpretation:** “Beyond flat zone+bin” for **this product line** is satisfied by **bin-granular rack coordinates + zone semantics**, surfaced in **Setup** (including rack front map where implemented), not by introducing a general **parent/child zone tree** or **`Aisle` master table** in this capsule.

## Deferred (explicit backlog)

- **Multi-level zone hierarchy** (e.g. `WarehouseZone.parentZoneId`, building → level → zone).
- **First-class aisle / tunnel entities** separate from bin text fields.
- **MM-accurate geometry, 3D, or digital twin** meshes.
- **Site-to-site network graphs** as first-class schema (beyond tenant + warehouse list).

These require product prioritization, migration design, and UI ownership—out of WE-10 scope.

## Consequences

- **GAP_MAP** R1 zone row remains **🟡 partial**: capabilities match demo depth; blueprint “full topology” remains intentionally narrowed.
- **API / UI** continue to use existing `GET /api/wms` payloads for zones/bins; no new topology endpoints required for WE-10 closure.
- Future capsules may add nullable **`parentZoneId`** or an **`Aisle`** table **if** reporting or directed workflows require it—this ADR should be amended then.

## References

- [`GAP_MAP.md`](./GAP_MAP.md) — R1 zone row.
- [`ENTERPRISE_TRACK.md`](./ENTERPRISE_TRACK.md) — WE-10 capsule.
