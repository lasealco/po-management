# Control Tower operations map — Phase 3.4 / WE-11

**Status:** Accepted — 2026-04-29 (**WE-11** closure vs [`ENTERPRISE_TRACK.md`](./ENTERPRISE_TRACK.md)).

**Upstream brief:** [`CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md`](../engineering/CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md) — Phase **3.4** (“if product wants depth”), especially **WMS floor / globe / CRM layers**.

## What “funded” means here

Phase 3 **MVP** shipped **`/control-tower/map`** with **shipment pins** (`org.controltower` → **view**). The Phase 3 brief explicitly deferred **WMS site/floor** and **CRM pins** **inside** the Leaflet map for that MVP.

For **WE-11**, product-aligned delivery is:

1. **Shipped slice:** **Bidirectional navigation** between Control Tower **Shipment map** and **WMS workspace** when the actor holds **both** grants (`org.controltower` → **view** *and* `org.wms` → **view**). This satisfies **cross-surface deep-links without floor geometry** as described in the Phase 3 “Next (3.4)” note (2026-04-25 bullet).
2. **BF-11 (blueprint capsule) shipped slice:** Optional **`Warehouse`** **site** markers on the same **`/control-tower/map`** Leaflet canvas when **`org.wms` → view**: **`GET /api/control-tower/map-pins`** appends **`warehousePins`** resolved via **`product-trace-geo`** city/country/name heuristics (`buildWarehouseMapPins`). Toggleable layer alongside shipment pins; **not** WMS rack/floor tiles.
3. **Explicit won’t-do (this capsule family):** **No** Leaflet layers that embed **WMS rack/floor** tiles, **warehouse CAD footprints**, or **CRM sales-order pins** from structured CRM geo — those remain backlog until funded separately (would touch CT map client, possibly geo assets, CRM addresses).

## Implementation pointers (dual-grant users)

| From | Condition | Link |
|------|-----------|------|
| **`/wms`** | `viewerHas(grantSet, "org.controltower", "view")` | **Open shipment map** → `/control-tower/map` (`src/app/wms/page.tsx`) |
| **`/control-tower/map`** | `viewerHas(grantSet, "org.wms", "view")` | **WMS workspace** → `/wms` (`src/app/control-tower/map/page.tsx`) |

**BF-11 warehouse pins:** `src/lib/control-tower/map-layers.ts` (`buildWarehouseMapPins`) + `src/app/api/control-tower/map-pins/route.ts`; UI toggles in `control-tower-map-client.tsx`.

Users without one of the grants see only the corresponding surface; no broken routes.

## Where WMS “floor” lives instead

**Warehouse rack / bin addressing** remains **first-class in WMS** (**Setup** rack front map, bin **`rackCode`** / **`aisle`** / **`bay`** / **`level`** / **`positionIndex`** — see [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md)), **not** merged into the CT shipment map layer stack.

## Follow-ups (not WE-11 / BF-11)

- Globe adoption metrics / richer world tiles (**Phase 3** roadmap language).
- Optional CRM pin layer (**`org.crm`**) once **`CrmAccount`** (or contacts) carry geo — CRM module ownership.
- Any **single-map** UX combining OT lanes + **indoor** warehouse geometry — new capsule + design.
