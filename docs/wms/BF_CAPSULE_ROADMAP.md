# Blueprint finish (`BF-xx`) — roadmap after BF-01

**Purpose:** Track **blueprint-finish capsules** after **`BF-01`**: **Done** table (**`BF-02` … `BF-22`** minimal slices where noted), **next program draft** (**`BF-23` … `BF-30`** — [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md)), capsule cards, and how to execute prompts — see [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md), [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), and [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md).

**Authority:** Capsule IDs and themes match [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). **`GAP_MAP.md`** stays the repo ↔ blueprint truth.

**Typical WMS paths:** [`docs/engineering/agent-todos/wms.md`](../engineering/agent-todos/wms.md) — stay inside `src/app/wms/**`, `src/app/api/wms/**`, `src/lib/wms/**` unless an issue explicitly allows CRM/CT/shared touches.

---

## Done

| ID | Theme | Notes |
|----|--------|--------|
| **BF-01** | Receiving line variance | Thin **`ShipmentItem`** counts + disposition via `set_shipment_item_receive_line` — [`WMS_RECEIVING_LINE_VARIANCE_BF01.md`](./WMS_RECEIVING_LINE_VARIANCE_BF01.md); optional **`WmsReceipt`** dock session wrapper — **BF-12** |
| **BF-02** | Lot / batch master (metadata) | **`WmsLotBatch`** + `set_wms_lot_batch`; unit-level serials → **BF-13** — [`WMS_LOT_BATCH_BF02.md`](./WMS_LOT_BATCH_BF02.md) |
| **BF-03** | Allocation depth (FEFO) | **`FEFO_BY_LOT_EXPIRY`** on waves + tests — [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md); **BF-15** greedy + unit cap minimal; MILP/carton cube backlog |
| **BF-04** | Zone parent hierarchy (DAG) | **`WarehouseZone.parentZoneId`** + `set_zone_parent` + Setup UI — [`WMS_ZONE_PARENT_BF04.md`](./WMS_ZONE_PARENT_BF04.md); **Aisles** / mm geometry still backlog — [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md) |
| **BF-05** | Dock yard ops slice | **`WmsDockAppointment`** carrier/trailer + **`record_dock_appointment_yard_milestone`** — [`WMS_DOCK_YARD_BF05.md`](./WMS_DOCK_YARD_BF05.md); **BF-17** TMS webhook stub — [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md); production **TMS** backlog |
| **BF-06** | WMS scoped RBAC tiers | **`org.wms.setup` / `operations` / `inventory`** + `gateWmsPostMutation` — [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md); **BF-16** adds **`org.wms.inventory.lot`** — [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md) |
| **BF-07** | Executive / blueprint KPIs | WE-09 + proxies/narratives + optional **`wh`** scope — [`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md), [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md); **BF-20** adds **`rates`** on **`fetchWmsHomeKpis`**; delivered OTIF % / engineered labor / ABC slotting backlog |
| **BF-08** | Packing GS1/ZPL integration stub | Demo SSCC + ship-station **ZPL** download — [`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md), [`WMS_PACKING_LABELS_BF08.md`](./WMS_PACKING_LABELS_BF08.md); scanner / carrier APIs backlog |
| **BF-09** | VAS portal intake & estimates | **`/wms/vas-intake`**, CRM link + **`CUSTOMER_PORTAL`** WO + commercial cents/min ([`WMS_VAS_BF09.md`](./WMS_VAS_BF09.md)); **BF-18** multi-line BOM snapshot + consume ([`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md)); SSO portal backlog |
| **BF-10** | CRM quote → outbound lineage | **`OutboundOrder.sourceCrmQuoteId`**, CRM handoff link + WMS picker ([`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md)); **BF-14** SKU explosion |
| **BF-11** | CT map WMS warehouse sites | Optional **■ warehouse pins** on **`/control-tower/map`** when **`org.wms` → view ([`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md)); **BF-19** adds CRM HQ ◆ pins when **`org.crm` → view`; rack floor CAD on map still backlog |
| **BF-12** | Receiving Option B (dock receipt session) | **`WmsReceipt`** / **`WmsReceiptLine`**, `create_wms_receipt` / `close_wms_receipt` / `set_wms_receipt_line` + inbound UI — [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md); **BF-21** adds history + idempotent close + optional **`RECEIPT_COMPLETE`** — [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md); carrier ASN auto-close / GRN backlog |
| **BF-13** | Serial / unit genealogy | **`WmsInventorySerial`** / **`WmsInventorySerialMovement`**, register/balance/attach POST actions + **trace** query — [`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md); automation from handlers / full GS1 still backlog |
| **BF-14** | CPQ quote lines → outbound | **`CrmQuoteLine.inventorySku`**, **`explode_crm_quote_to_outbound`**, CRM + Operations UI — [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md); **BF-22** list/tier + **`commercial*`** snapshots — [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md); full CPQ solver backlog |
| **BF-15** | Wave allocation v2 (minimal) | **`GREEDY_MIN_BIN_TOUCHES`** + **`pickWaveCartonUnits`** + Setup UI — [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md); MILP / cube / labor-aware backlog |
| **BF-17** | TMS dock stub (minimal) | **`tmsLoadId` / `tmsCarrierBookingRef`**, **`POST /api/wms/tms-webhook`**, `set_dock_appointment_tms_refs` — [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md); production TMS backlog |
| **BF-18** | VAS multi-line BOM (minimal) | **`WmsWorkOrderBomLine`**, **`replace_work_order_bom_lines`**, **`consume_work_order_bom_line`** — [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md); automated BOM/MRP backlog |
| **BF-19** | CT map CRM HQ pins (minimal) | **`CrmAccount.mapLatitude` / `mapLongitude`**, **`crmAccountPins`** on **`GET /api/control-tower/map-pins`**, CRM account workspace save — [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md); geocode / rack-floor map backlog |
| **BF-20** | Executive KPI rates (minimal) | **`buildExecutiveRates`** + **`rates`** / **`rateMethodology`** on **`fetchWmsHomeKpis`**, `/wms` executive cards — [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md); delivered OTIF % / engineered labor / ABC slotting backlog |
| **BF-21** | Receipt accounting (minimal) | **`closedWmsReceiptHistory`**, idempotent **`close_wms_receipt`**, **`receiptCompleteOnClose`** — [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md); carrier ASN auto-close / GRN backlog |
| **BF-22** | CPQ contracted pricing (minimal) | **`listUnitPrice`** / **`priceTierLabel`** on **`CrmQuoteLine`**, **`resolveQuoteLineCommercialPricing`**, explosion preview + **`OutboundOrderLine.commercial*`** — [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md); external price books / ladders backlog |

---

## Recommended order (adjust with product)

Order follows [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md) **Phase A → E**: inventory truth before execution engines; topology/yard before throwing integrations at cross-product epics.

**Blueprint finish capsules `BF-02` … `BF-11` are complete in this roadmap snapshot.** **`BF-12`** … **`BF-22`** have **minimal slices shipped** in-repo ([`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md)). **`BF-23`** … **`BF-30`** are **defined as draft capsules** only ([`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md); catalog rows in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md)). Further enterprise depth → [`CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](../engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md).

| Order | ID | Phase | Notes |
|-------|-----|-------|------|
| 1 | **BF-12** | A — Inventory / receiving | ✅ **Minimal landed** — `WmsReceipt` session + `set_wms_receipt_line`; see mega-phase doc |
| 2 | **BF-13** | A — Lots / serialization | ✅ **Minimal landed** — `WmsInventorySerial` + trace query + Stock UI; full automation backlog |
| 3 | **BF-14** | E — Cross-product | ✅ **Minimal landed** — `inventorySku` + `explode_crm_quote_to_outbound`; see mega-phase doc |
| 4 | **BF-15** | B — Execution | ✅ **Minimal landed** — `GREEDY_MIN_BIN_TOUCHES` + `pickWaveCartonUnits`; see mega-phase doc |
| 5 | **BF-16** | D — Governance | ✅ **Minimal landed** — `org.wms.inventory.lot` + POST inventory split; see mega-phase doc |
| 6 | **BF-17** | C — Topology / yard | ✅ **Minimal landed** — TMS webhook stub + dock refs; see mega-phase doc |
| 7 | **BF-18** | R3 — VAS depth | ✅ **Minimal landed** — `WmsWorkOrderBomLine` + consume/replace POST + Operations UI + **`db:seed:wms-vas-bom-demo`** |
| 8 | **BF-19** | Enterprise map | ✅ **Minimal landed** — CRM **`mapLatitude`/`mapLongitude`** + **`crmAccountPins`** + map toggles (`buildCrmAccountMapPins`); demo seed sets Demo Logistics coords |
| 9 | **BF-20** | D — Analytics | ✅ **Minimal landed** — **`rates`** + **`rateMethodology`** on **`fetchWmsHomeKpis`** (`buildExecutiveRates`) |
| 10 | **BF-21** | A — Receiving depth | ✅ **Minimal landed** — receipt history payload + idempotent close + optional **`RECEIPT_COMPLETE`** ([`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md)) |
| 11 | **BF-22** | E — Commercial pricing | ✅ **Minimal landed** — quote line list/tier + resolver + explosion deltas + **`OutboundOrderLine.commercial*`** ([`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md)) |

**Parallelization:** historical note — **BF-04** / **BF-05** / commercial (**BF-10**) often ran in parallel when teams differed.

---

## Capsule cards (`BF-02` … `BF-22` + draft `BF-23` … `BF-30`)

Use one row as the **scope box** before filing GitHub issues or agent prompts.

| ID | `GAP_MAP` signal | Primary docs | Shared / CRM / CT? | Status |
|----|------------------|--------------|---------------------|--------|
| **BF-02** | SKU / UOM / lot | [`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md), [`WMS_LOT_BATCH_BF02.md`](./WMS_LOT_BATCH_BF02.md) | Catalog overlap (`Product`); else WMS | **Partial** — `WmsLotBatch` + UI + **BF-13** serial slice |
| **BF-03** | Allocation | [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md) | WMS-only core | **Partial** — **`FEFO_BY_LOT_EXPIRY`** + fungible/FIFO/MAX + **BF-15** greedy/cap; MILP backlog |
| **BF-04** | Zone / aisle | [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md), [`WMS_ZONE_PARENT_BF04.md`](./WMS_ZONE_PARENT_BF04.md) | WMS | **Partial** — **`parentZoneId`** + `set_zone_parent` + UI; **Aisles** / geometry backlog |
| **BF-05** | Appointments / TMS | [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md), [`WMS_DOCK_YARD_BF05.md`](./WMS_DOCK_YARD_BF05.md) | Integrations | **Partial** — WE-02 + BF-05 yard slice + **BF-17** TMS stub refs/webhook; **full TMS** backlog |
| **BF-06** | Permissions | [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md), [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md) | **Platform + auth** | **Partial** — BF-06 tier grants + action map; **BF-16** `inventory.lot` slice for `set_wms_lot_batch`; full matrix backlog |
| **BF-07** | Dashboards | [`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md), [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md) | Product + WMS | **Partial** — WE-09 + BF-07 proxies/narratives + **BF-20** rate fields; delivered OTIF % / engineered labor / ABC backlog |
| **BF-08** | Packing | [`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md), [`WMS_PACKING_LABELS_BF08.md`](./WMS_PACKING_LABELS_BF08.md) | Vendors / hardware | **Partial** — WE-06 pack/ship + BF-08 ZPL + demo SSCC; scanner/carrier backlog |
| **BF-09** | VAS | [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md), [`WMS_VAS_BF09.md`](./WMS_VAS_BF09.md) | Portal + commercial assumptions | **Partial** — WE-04 + BF-09 intake + **BF-18** BOM lines; SSO/automated BOM backlog |
| **BF-10** | Commercial | [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md) | **CRM + commercial** | Partial — bill-to + **`sourceCrmQuoteId`** lineage + **BF-14** SKU explosion |
| **BF-11** | Enterprise CT map | [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md) | **CT + WMS + CRM** | **Partial** — WE-11 links + **BF-11** warehouse pins + **BF-19** CRM HQ coords; indoor rack CAD on map ❌ |
| **BF-12** | Receiving Option B | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md) | WMS | **Partial** — `WmsReceipt` session + line posts + **BF-21** history / close policy |
| **BF-13** | Serial / genealogy | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md) | WMS | **Partial** — registry + trace + Stock UI; handler automation backlog |
| **BF-14** | Quote → outbound lines | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md) | **CRM + WMS** | **Partial** — SKU column + explosion POST + preview UI + **BF-22** list/tier pricing; CPQ solver backlog |
| **BF-15** | Wave allocation v2 | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md) | WMS | **Partial** — greedy min-touch + optional unit cap; solver backlog |
| **BF-16** | Lot vs qty inventory ACL | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md) | Platform + WMS | **Partial** — `org.wms.inventory.lot` + manifest; broader matrix backlog |
| **BF-17** | TMS dock stub | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md) | Integrations + WMS | **Partial** — webhook Bearer stub + columns + POST action; carrier certify backlog |
| **BF-18** | VAS BOM lines | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md) | WMS | **Partial** — snapshot + consumption postings + UI; MRP/engineering-change backlog |
| **BF-19** | CT CRM map pins | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md) | CT + CRM | **Partial** — explicit account lat/lng + map layer; automatic geocode backlog |
| **BF-20** | Executive KPI rates | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md) | Product + WMS | **Partial** — proxy **`rates`** + methodology strings; full analytics backlog |
| **BF-21** | Receipt accounting | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md) | WMS | **Partial** — closed receipt history + idempotent close + optional status advance; GRN / carrier ASN backlog |
| **BF-22** | CPQ contracted pricing | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md) | **CRM + WMS** | **Partial** — list vs contract on quote lines + resolver + outbound snapshots; external price books backlog |

### Draft — **`BF-23` … `BF-30`** (not shipped)

Program objectives and prompt stub: [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md). Catalog rows: [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md).

---

## What “create those capsules” means here

| Artifact | Location |
|----------|-----------|
| IDs + themes | Already in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md) |
| **Order + dependency narrative** | This file |
| Execution | **One capsule per milestone:** GitHub issue (label `module:wms`) or agent prompt with **`BF-xx`** in the title and goals copied from the **correct** row — **not** the BF-01 template unless the capsule **is** BF-01 |

We **did not** add duplicate per-capsule specs beside existing theme docs — avoid scatter; deepen **`docs/wms/*`** when a capsule ships (ADR / limits + **`GAP_MAP`** row).

---

_Last updated: 2026-05-03 — **BF-22** CPQ contracted pricing minimal ([`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md)); **BF-21** receipt accounting minimal ([`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md)); **`BF-23`–`BF-30`** draft program; **BF-20** KPI proxy rates; **`BF-02`–`BF-22`** Done table; **BF-11** + **BF-19** CT map pins._
