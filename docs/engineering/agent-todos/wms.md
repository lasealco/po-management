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
- [ ] **Commercial quotes** (R3 Phase C) — likely CRM overlap; own issue.

---

## UX / ops polish (🟡 areas)

- [ ] **Packing / labels** — extend workflow beyond current “limited” note in GAP (issue must list acceptance).
- [x] **Wave / replenishment** — **REPLENISH** open tasks: **source bin → target bin** in Operations (`sourceBin` in `GET /api/wms`); wave release/complete unchanged; **landed** 2026-04-25.
- [ ] **Dashboards** — deepen `/wms` “At a glance” vs blueprint KPIs.

---

## Hygiene

- [x] **2026-04-26** — `docs/wms/GAP_MAP.md` _Last updated_ + handoff blockquote; ongoing PRs should still refresh the GAP.
