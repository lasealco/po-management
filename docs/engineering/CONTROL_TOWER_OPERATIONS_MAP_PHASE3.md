# Control Tower — operations map (Phase 3) — product brief

**Status:** Phase 3.3 **MVP shipped** (`/control-tower/map` + `GET /api/control-tower/map-pins`, 2026-04-23). This note satisfies roadmap step **3.1** (scope / layers) and **3.2** (library + data source of truth for the sprint).

**Roadmap link:** [`CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](./CONTROL_TOWER_WMS_PHASED_ROADMAP.md) Phase 3.

## Layers and grants (MVP)

| Layer | Grant | Read-only? | Data |
|--------|--------|------------|------|
| **Shipments (workbench scope)** | `org.controltower` → `view` | Yes — pins link to 360, no in-map edit | `listControlTowerShipments` with **same URL query** as workbench; pins from booking/leg `originCode` / `destinationCode` via `src/lib/product-trace-geo.ts` (LOCODE / IATA dictionary; same family as product trace). |
| **WMS warehouse site (approx.)** | `org.wms` → `view` (+ CT map route still requires `org.controltower` → `view`) | Yes — links to **WMS setup** | **BF-11:** **`Warehouse`** pins appended by **`GET /api/control-tower/map-pins`** (`buildWarehouseMapPins` — city/country/name demo geo); **not** indoor rack tiles |
| WMS rack/floor tiles on CT map | — | Not shipped | Use **WMS Setup** rack front map |
| CRM / SO pins | `org.crm` (if any) | Not shipped | Defer until CRM carries geo |

**Non-goals (MVP):** live editing, vehicle GPS, WMS bin geometry, full geocoding service.

## Technical notes

- **Map lib:** Leaflet (already in repo; same tile layer pattern as `product-trace-explorer`).
- **Coordinates:** No `Shipment` lat/lng columns; positions are **derived** from known lane codes. Rows with no mappable code are skipped; `unmappedCount` in API JSON explains gap vs workbench count.
- **Filter parity:** `parseControlTowerShipmentsListQuery` in `src/lib/control-tower/shipments-list-query-from-search-params.ts` is shared by `GET /api/control-tower/shipments` and `GET /api/control-tower/map-pins`.

## Next (3.4) — if product wants depth

- **2026-04-25 (cross-surface, no floor geometry):** `/wms` home shows **Open shipment map** when the actor has `org.controltower` → **view** (in addition to WMS). `/control-tower/map` shows **WMS workspace** when the actor has `org.wms` → **view**.
- **BF-11 (2026-04-29):** **`Warehouse`** **site** pins (approximate WGS84 via **`product-trace-geo`** city/country/name hints) on **`/control-tower/map`** when the actor has **`org.wms` → view** — `src/lib/control-tower/map-layers.ts`, toggles in **`control-tower-map-client.tsx`**. Indoor rack layers remain **WMS Setup**.
- CRM geo pins + richer globe adoption metrics remain backlog ([`GAP_MAP.md`](../wms/GAP_MAP.md) Enterprise row — ❌ rack floor / CRM structured geo).
