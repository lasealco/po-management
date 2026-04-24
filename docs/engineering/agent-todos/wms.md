# WMS — agent todo list

**GitHub label:** `module:wms`  
**Typical allowed paths:** `src/app/wms/**`, `src/app/api/wms/**`, `src/lib/wms/**`, WMS-specific UI under `src/components/**` only if scoped in the issue  
**Avoid:** CRM, tariff, unrelated `prisma` domains unless the issue requires a small shared touch.

**Source of truth:** `docs/wms/GAP_MAP.md` + PDFs in `docs/wms/`.

**Phased program (WMS + Control Tower):** [`docs/engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](../CONTROL_TOWER_WMS_PHASED_ROADMAP.md) — WMS is **Phase 2** in that file (after CT Phase 1 verticals; **Program Phase 0 re-pass** 2026-04-25 refreshed `docs/wms/GAP_MAP.md` _Last updated_).

---

## Phase A continuation (GAP “next optional increments”)

- [x] **Saved ledger views** — `WmsSavedLedgerView` + `/api/wms/saved-ledger-views` (GET list, POST create, DELETE by id); Stock page UI was already wired; **landed** 2026-04-23 (parity with per-user `CtSavedFilter` pattern).
- [x] **Outbound ASN parity** — `OutboundOrder.asnReference` + `requestedShipDate` in API + `set_outbound_order_asn_fields` + WMS **Outbound flow**; **landed** 2026-04-25.
- [ ] **Deeper receiving states** — if product defines the state machine in an issue first.

---

## Gaps marked ❌ / deferred (epic-sized — split before coding)

- [ ] **Appointment scheduling** (R2) — spec + schema slice first.
- [ ] **VAS / work orders** (R3 Phase C) — separate epic after blueprint.
- [ ] **Commercial quotes** (R3 Phase C) — likely CRM overlap; own issue.

---

## UX / ops polish (🟡 areas)

- [ ] **Packing / labels** — extend workflow beyond current “limited” note in GAP (issue must list acceptance).
- [x] **Wave / replenishment** — **REPLENISH** open tasks: **source bin → target bin** in Operations (`sourceBin` in `GET /api/wms`); wave release/complete unchanged; **landed** 2026-04-25.
- [ ] **Dashboards** — deepen `/wms` “At a glance” vs blueprint KPIs.

---

## Hygiene

- [ ] After meaningful WMS PR: refresh `docs/wms/GAP_MAP.md` “Last updated” + row notes.
