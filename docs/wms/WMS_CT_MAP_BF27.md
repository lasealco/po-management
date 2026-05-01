# BF-27 — Control Tower approximate warehouse-bin pins

**Purpose:** Minimal indoor-map capsule — overlay **`WarehouseBin`** “scatter” pins on **`/control-tower/map`** without CAD tiles or surveyed rack geometry.

**Authority:** [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-27; CT map program [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md).

---

## What shipped

| Piece | Role |
|-------|------|
| **`buildWarehouseBinMapPins`** | Maps active bins whose **`warehouseId`** has a BF-11 site coordinate → deterministic **`warehouseBinScatterCoordinate`** near that jittered site (**scaled jitter**, not WGS84 rack survey). |
| **`GET /api/control-tower/map-pins`** | **`warehouseBinPins`** + **`warehouseBinPinsTruncated`** when **`org.wms` → view**, warehouses produced ≥1 site pin, and bins exist (**cap 200**, stable sort). |
| **`control-tower-map-client.tsx`** | Toggle **WMS bins (▲ scatter near site)**; teal triangle markers; popups link **`/wms/setup`**. |
| **Privacy / perf** | Subtitles state **approximate offset / not surveyed geometry**; bin list capped; no tenant-wide bin dump beyond mapped warehouses. |

---

## Backlog

CAD footprints, RTLS tracks, automatic lat/lng from aisle/mm masters (**BF-24** geometry stays Setup-first).

---

_Last updated: 2026-04-29 — BF-27 minimal CT bin scatter layer._
