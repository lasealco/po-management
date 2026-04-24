# Phase 5 (portfolio) — map depth & WMS long-tail

**Context:** This is the **fifth and last** phase in [`CONTROL_TOWER_WMS_BACKLOG_5_PHASES.md`](./CONTROL_TOWER_WMS_BACKLOG_5_PHASES.md) (phases **1–5** only; not “Phase 15”).

**Status:** Parking lot + pointers. Heavy build items stay **issue-gated**; adoption / funding first.

**Last updated:** 2026-04-26

---

## 1. Operations map 3.4 (Control Tower + WMS + CRM)

| Track | Today | Next when product wants it |
|-------|--------|----------------------------|
| **Shipments map (MVP)** | Shipped: `/control-tower/map`, workbench-parity filters, `GET …/map-pins`. | Monitor usage; no mandate to deepen. |
| **Cross-surface entry** | Shipped: dual-grant WMS ↔ map links (see [CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md](CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md)). | — |
| **WMS floor / rack** | Not in MVP; WMS GAP rows 🟡. | New issue: data for bin geometry, tile scope, `org.wms` read model. |
| **Globe / “world” view** | Deferred in map brief. | New issue: product bet vs Leaflet; perf + UX. |
| **CRM / SO map pins** | Not in MVP; needs `org.crm` + entity geo strategy. | New issue: with CRM; not Control Tower–only. |

**Authoritative brief:** [CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md](CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md) § “Next (3.4)”.

---

## 2. WMS deferred epics (❌ in GAP)

| Theme | GAP | Before code |
|-------|-----|------------|
| Dock **appointments** | R3 / deferred | Spec + schema slice + tenant rules |
| **VAS** / work orders | R3 / deferred | Separate epic; often overlaps ops |
| **Commercial quotes** | R3 / deferred | Often CRM overlap; own issue |

**Authoritative list:** [docs/wms/GAP_MAP.md](../wms/GAP_MAP.md) (R3, deferred table).

---

## 3. Suggested issue titles (when scheduling)

- `[map] 3.4 — WMS floor plan (MVP scope + data source)`  
- `[map] 3.4 — optional globe / zoomed world layer (adoption-gated)`  
- `[crm+map] SO / account pins on operations map`  
- `[wms] Appointments (dock) — spec + first slice`  
- `[wms] VAS / work orders — epic kickoff`  

Use **`module:tower`**, **`module:wms`**, or **`module:crm`** labels per touch surface.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-26 | Initial Phase 5 steering note (5-phase portfolio, not 15). |
