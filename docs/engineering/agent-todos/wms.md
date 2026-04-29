# WMS — agent todo list

**GitHub label:** `module:wms`  
**Typical allowed paths:** `src/app/wms/**`, `src/app/api/wms/**`, `src/lib/wms/**`, WMS-specific UI under `src/components/**` only if scoped in the issue  
**Avoid:** CRM, tariff, unrelated `prisma` domains unless the issue requires a small shared touch.

**Source of truth:** `docs/wms/GAP_MAP.md` + PDFs in `docs/wms/`.

**Enterprise finish line:** [`docs/wms/ENTERPRISE_TRACK.md`](../wms/ENTERPRISE_TRACK.md) — prompt by capsule **WE-01**–**WE-12** (independent of Assistant Sprint numbering).

**Phased program (WMS + Control Tower):** [`docs/engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](../CONTROL_TOWER_WMS_PHASED_ROADMAP.md) — WMS is **Phase 2** in that file. **Tranche handoff (2026-04-26):** **2.1 / 2.2 / 2.4** (replenish) **closed**; optional backlog = **2.3**, dashboard/packing, deferred ❌ — see [roadmap § handoff](../CONTROL_TOWER_WMS_PHASED_ROADMAP.md#program-tranche-handoff-2026-04-26).

---

## Phase A continuation (GAP “next optional increments”)

- [x] **Saved ledger views** — `WmsSavedLedgerView` + `/api/wms/saved-ledger-views` (GET list, POST create, DELETE by id); Stock page UI was already wired; **landed** 2026-04-23 (parity with per-user `CtSavedFilter` pattern).
- [x] **Outbound ASN parity** — `OutboundOrder.asnReference` + `requestedShipDate` in API + `set_outbound_order_asn_fields` + WMS **Outbound flow**; **landed** 2026-04-25.
- [x] **Deeper receiving states — spec** — [WMS_RECEIVING_STATE_MACHINE_SPEC.md](../wms/WMS_RECEIVING_STATE_MACHINE_SPEC.md) (2026-04-23). **Next:** file implementation issue (schema option A/B/C + first transitions); not started in code.

---

## Gaps marked ❌ / deferred (epic-sized — split before coding)

- [ ] **Appointment scheduling** (R2) — spec + schema slice first.
- [x] **VAS / work orders** (R3) — **WE-04 MVP** shipped (`WmsWorkOrder`, `VALUE_ADD`, Operations UI — [`WMS_VAS_WORK_ORDERS.md`](../../wms/WMS_VAS_WORK_ORDERS.md)); portal/BOM depth backlog.
- [x] **Commercial quotes** (R3 Phase C) — **WE-07 contract doc**: [`WMS_COMMERCIAL_HANDOFF.md`](../../wms/WMS_COMMERCIAL_HANDOFF.md) (bill-to via `crmAccountId`; automated quote→outbound deferred — CRM owner).

---

## UX / ops polish (🟡 areas)

- [x] **Packing / labels** — WE-06: [`WMS_PACKING_LABELS.md`](../wms/WMS_PACKING_LABELS.md), Operations ship-station workflow + print pack slip + `CtAuditLog` on pack/ship.
- [x] **RBAC / audit (WE-08)** — [`WMS_RBAC_AND_AUDIT.md`](../wms/WMS_RBAC_AND_AUDIT.md); coarse `org.wms` grants + `wms-api-grants` Vitest harness (`src/lib/wms/wms-api-grants.*`).
- [x] **Wave / replenishment** — **REPLENISH** open tasks: **source bin → target bin** in Operations (`sourceBin` in `GET /api/wms`); wave release/complete unchanged; **landed** 2026-04-25.
- [x] **Dashboards (WE-09)** — executive KPI row + `GET /api/wms?homeKpis=1` + [`WMS_EXECUTIVE_KPIS.md`](../wms/WMS_EXECUTIVE_KPIS.md); blueprint OTIF/labor depth still backlog.
- [x] **Zone / topology (WE-10)** — [`WMS_ZONE_TOPOLOGY_ADR.md`](../wms/WMS_ZONE_TOPOLOGY_ADR.md); no migration — bin rack addressing + functional zones documented; parent-zone / aisle entities backlog.
- [x] **CT map Phase 3.4 / WE-11** — [`WMS_CT_MAP_PHASE34_WE11.md`](../wms/WMS_CT_MAP_PHASE34_WE11.md); dual-grant `/wms` ↔ `/control-tower/map` links; in-map WMS floor + CRM globe pins deferred.

---

## Hygiene

- [x] **2026-04-26** — `docs/wms/GAP_MAP.md` _Last updated_ + handoff blockquote; ongoing PRs should still refresh the GAP.
