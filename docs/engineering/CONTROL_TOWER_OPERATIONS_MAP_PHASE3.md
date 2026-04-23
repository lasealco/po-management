# Control Tower — operations map (Phase 3) — product brief

**Status:** Phase 3.3 **MVP shipped** (`/control-tower/map` + `GET /api/control-tower/map-pins`, 2026-04-23). This note satisfies roadmap step **3.1** (scope / layers) and **3.2** (library + data source of truth for the sprint).

**Roadmap link:** [`CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](./CONTROL_TOWER_WMS_PHASED_ROADMAP.md) Phase 3.

## Layers and grants (MVP)

| Layer | Grant | Read-only? | Data |
|--------|--------|------------|------|
| **Shipments (workbench scope)** | `org.controltower` → `view` | Yes — pins link to 360, no in-map edit | `listControlTowerShipments` with **same URL query** as workbench; pins from booking/leg `originCode` / `destinationCode` via `src/lib/product-trace-geo.ts` (LOCODE / IATA dictionary; same family as product trace). |
| WMS site / floor | `org.wms` | Not in this MVP | Defer to Phase 3.4 / WMS GAP. |
| CRM / SO pins | `org.crm` (if any) | Not in this MVP | Defer. |

**Non-goals (MVP):** live editing, vehicle GPS, WMS bin geometry, full geocoding service.

## Technical notes

- **Map lib:** Leaflet (already in repo; same tile layer pattern as `product-trace-explorer`).
- **Coordinates:** No `Shipment` lat/lng columns; positions are **derived** from known lane codes. Rows with no mappable code are skipped; `unmappedCount` in API JSON explains gap vs workbench count.
- **Filter parity:** `parseControlTowerShipmentsListQuery` in `src/lib/control-tower/shipments-list-query-from-search-params.ts` is shared by `GET /api/control-tower/shipments` and `GET /api/control-tower/map-pins`.

## Next (3.4) — if product wants depth

- WMS rack/floor where GAP is 🟡; richer world map (globe) only if `/control-tower/map` shows adoption.
