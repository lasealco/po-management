# Blueprint finish (`BF-xx`) — roadmap after BF-01

**Purpose:** After **`BF-01`** (receiving line variance — [`WMS_RECEIVING_LINE_VARIANCE_BF01.md`](./WMS_RECEIVING_LINE_VARIANCE_BF01.md)) landed, this file lists **remaining capsules** **`BF-02` … `BF-11`**, a **dependency-aware default order**, and **what “create” means** here (documentation + prompts — not automatic code).

**Authority:** Capsule IDs and themes match [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). **`GAP_MAP.md`** stays the repo ↔ blueprint truth.

**Typical WMS paths:** [`docs/engineering/agent-todos/wms.md`](../engineering/agent-todos/wms.md) — stay inside `src/app/wms/**`, `src/app/api/wms/**`, `src/lib/wms/**` unless an issue explicitly allows CRM/CT/shared touches.

---

## Done

| ID | Theme | Notes |
|----|--------|--------|
| **BF-01** | Receiving line variance | Thin Option **A** on **`ShipmentItem`** + `set_shipment_item_receive_line`; **`WmsReceipt`** / Option **B** still backlog — [`WMS_RECEIVING_LINE_VARIANCE_BF01.md`](./WMS_RECEIVING_LINE_VARIANCE_BF01.md) |
| **BF-02** | Lot / batch master (metadata) | **`WmsLotBatch`** + `set_wms_lot_batch`; per-unit serial table still backlog — [`WMS_LOT_BATCH_BF02.md`](./WMS_LOT_BATCH_BF02.md) |
| **BF-03** | Allocation depth (FEFO) | **`FEFO_BY_LOT_EXPIRY`** on waves + tests — [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md); carton/solver engine backlog |
| **BF-04** | Zone parent hierarchy (DAG) | **`WarehouseZone.parentZoneId`** + `set_zone_parent` + Setup UI — [`WMS_ZONE_PARENT_BF04.md`](./WMS_ZONE_PARENT_BF04.md); **Aisles** / mm geometry still backlog — [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md) |
| **BF-05** | Dock yard ops slice | **`WmsDockAppointment`** carrier/trailer + **`record_dock_appointment_yard_milestone`** — [`WMS_DOCK_YARD_BF05.md`](./WMS_DOCK_YARD_BF05.md); full **TMS** still backlog — [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md) |
| **BF-06** | WMS scoped RBAC tiers | **`org.wms.setup` / `operations` / `inventory`** + `gateWmsPostMutation` — [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md); **per-field** ACL still backlog — [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md) |
| **BF-07** | Executive / blueprint KPIs | WE-09 + proxies/narratives + optional **`wh`** scope — [`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md), [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md); OTIF **rates** / productivity / slotting solver backlog |

---

## Recommended order (adjust with product)

Order follows [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md) **Phase A → E**: inventory truth before execution engines; topology/yard before throwing integrations at cross-product epics.

| Order | ID | Phase | Why this sequence |
|-------|-----|-------|-------------------|
| 1 | **BF-02** | A | Lot / serial depth feeds allocation and QA narratives ([`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md)); pairs naturally after BF-01 variance. |
| 2 | **BF-03** | B | Allocation solver / FEFO / wave policy depth ([`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md)) — needs stable lot semantics if FEFO-by-lot matters. |
| 3 | **BF-04** | C | Zone parent DAG + bin addressing ([`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md), [`WMS_ZONE_PARENT_BF04.md`](./WMS_ZONE_PARENT_BF04.md)); **first-class aisle entities** still backlog — isolate migrations from unrelated features. |
| 4 | **BF-05** | C | Carrier + yard milestones on **`WmsDockAppointment`** ([`WMS_DOCK_YARD_BF05.md`](./WMS_DOCK_YARD_BF05.md)); full TMS / EDI still backlog — builds on WE-02. |
| 5 | **BF-06** | D | Scoped WMS mutation tiers (**[`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md)**); **per-field** ACL matrix still backlog — [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md). |
| 6 | **BF-08** | R2-ish ops | GS1 / ZPL / scanner hardware ([`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md)) — vendor choices; can parallelize if resourced. |
| 7 | **BF-09** | R3 | VAS portal & BOM costing ([`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md)) — **WMS + portal**; commercial assumptions. |
| 8 | **BF-10** | E | CPQ → outbound automation ([`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md)) — **CRM (+ WMS API)** joint milestone. |
| 9 | **BF-11** | E | CT map merged layers ([`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md)) — **CT + WMS** (+ CRM pins if in scope); [`GAP_MAP`](./GAP_MAP.md) Enterprise row currently **❌** for in-map floor/pins. |

**Parallelization:** **BF-08** can often run in parallel with **BF-04** / **BF-05** if teams differ — dependencies above are **logical**, not strict calendar locks.

---

## Capsule cards (`BF-02` … `BF-11`)

Use one row as the **scope box** before filing GitHub issues or agent prompts.

| ID | `GAP_MAP` signal | Primary docs | Shared / CRM / CT? | Status |
|----|------------------|--------------|---------------------|--------|
| **BF-02** | SKU / UOM / lot | [`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md), [`WMS_LOT_BATCH_BF02.md`](./WMS_LOT_BATCH_BF02.md) | Catalog overlap (`Product`); else WMS | **Partial** — `WmsLotBatch` + UI |
| **BF-03** | Allocation | [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md) | WMS-only core | **Partial** — **`FEFO_BY_LOT_EXPIRY`** + fungible/FIFO/MAX; solver backlog |
| **BF-04** | Zone / aisle | [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md), [`WMS_ZONE_PARENT_BF04.md`](./WMS_ZONE_PARENT_BF04.md) | WMS | **Partial** — **`parentZoneId`** + `set_zone_parent` + UI; **Aisles** / geometry backlog |
| **BF-05** | Appointments / TMS | [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md), [`WMS_DOCK_YARD_BF05.md`](./WMS_DOCK_YARD_BF05.md) | Integrations | **Partial** — WE-02 + BF-05 yard slice; **full TMS** backlog |
| **BF-06** | Permissions | [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md), [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md) | **Platform + auth** | **Partial** — BF-06 tier grants + action map; **per-field** ACL backlog |
| **BF-07** | Dashboards | [`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md), [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md) | Product + WMS | **Partial** — WE-09 + BF-07 proxies & scope; analytics solver backlog |
| **BF-08** | Packing | [`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md) | Vendors / hardware | Partial — WE-06 pack/ship |
| **BF-09** | VAS | [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md) | Portal + commercial assumptions | Partial — WE-04 MVP |
| **BF-10** | Commercial | [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md) | **CRM + commercial** | Partial — bill-to handoff |
| **BF-11** | Enterprise CT map | [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md) | **CT + WMS** (+ CRM if pins) | Partial — WE-11 links; layers ❌ |

---

## What “create those capsules” means here

| Artifact | Location |
|----------|-----------|
| IDs + themes | Already in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md) |
| **Order + dependency narrative** | This file |
| Execution | **One capsule per milestone:** GitHub issue (label `module:wms`) or agent prompt with **`BF-xx`** in the title and goals copied from the **correct** row — **not** the BF-01 template unless the capsule **is** BF-01 |

We **did not** add duplicate per-capsule specs beside existing theme docs — avoid scatter; deepen **`docs/wms/*`** when a capsule ships (ADR / limits + **`GAP_MAP`** row).

---

_Last updated: 2026-04-29 — **BF-07** executive KPI proxies + warehouse scope (`WMS_EXECUTIVE_KPIS_BF07.md`, `fetchWmsHomeKpis`); **BF-06** scoped WMS RBAC tiers (`WMS_RBAC_BF06.md`, `org.wms.setup` / `operations` / `inventory`); **BF-05** dock yard milestones (`WMS_DOCK_YARD_BF05.md`); **BF-03** FEFO allocation (`FEFO_BY_LOT_EXPIRY`); **BF-02** `WmsLotBatch` landed (`WMS_LOT_BATCH_BF02.md`, **`BF_CAPSULE_ROADMAP` Done**); roadmap scaffold after **BF-01**._
