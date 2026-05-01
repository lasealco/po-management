# Blueprint finish backlog (post enterprise track)

**Purpose:** After **`WE-01` … `WE-12`** closed ([`WMS_ENTERPRISE_EXIT_WE12.md`](./WMS_ENTERPRISE_EXIT_WE12.md)), this file is the **structured backlog** to drive **`GAP_MAP.md`** rows from **🟡 / deferred** toward **✅ or tightened 🟡** for **`wms_blueprint_and_technical_prd` Release 1–3** (same scope band as [`GAP_MAP.md`](./GAP_MAP.md)).

**Sources:** Rows and “Explicitly deferred” bullets in [`GAP_MAP.md`](./GAP_MAP.md); theme docs linked per row.

---

## Capsules vs sprints (how to run it)

| Unit | Role |
|------|------|
| **Capsule (`BF-01` …)** | Thematic slice with **clear exit**: schema/API/UI + **`GAP_MAP`** row updates + tests/seeds as appropriate. Same idea as **`WE-xx`**, but **`ENTERPRISE_TRACK`** stays **closed** unless product reopens it — track **`BF-xx`** here or in GitHub epics/milestones. |
| **Sprint (calendar)** | **Timebox**, not scope. A sprint usually carries **one primary capsule** (sometimes two **small** ones). **Finishing the whole blueprint is never “one sprint”** unless scope is aggressively cut. |

**Recommended rhythm:** Pick the next **`BF-xx`** → scope freeze for **that capsule only** → ship → refresh **`GAP_MAP`** → repeat.

---

## Phasing (dependency-aware)

Rough order — adjust when CRM/CT ownership blocks work:

| Phase | Focus | Why first |
|-------|--------|-----------|
| **A — Inventory truth** | Lot master / genealogy / receiving variance | Unlocks finance, QA, and downstream allocation accuracy ([`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md), [`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md)). |
| **B — Execution engines** | Allocation solver / FEFO / multi-strategy depth ([`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md)) | Builds on stable inventory semantics. |
| **C — Topology & yard** | Zone hierarchy / aisles / TMS-grade dock ([`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md), [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md)) | Often migration-heavy; separate from daily ops MVP. |
| **D — Governance & analytics** | Field-level WMS matrix ([`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md)); OTIF / labor / slotting KPIs ([`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md)) | Policy + reporting layers once flows are stable. |
| **E — Cross-product** | CPQ→outbound automation ([`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md)); CT map merged layers ([`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md)); VAS portal/BOM ([`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md)) | Requires CRM/CT alignment — **joint milestones**. |

---

## Capsule catalog (`BF-xx`) — draft IDs

Each capsule should end with: **`GAP_MAP.md` updated**, migrations listed if any, **`docs/wms/*`** note or ADR for limits.

| ID | Theme | Primary `GAP_MAP` signal | Depends on | Owner emphasis |
|----|--------|---------------------------|------------|----------------|
| **BF-01** | **Receiving line variance** — receipt vs ASN lines, disposition | Inbound ASN row; tranche note line variance | [`WMS_RECEIVING_LINE_VARIANCE_BF01.md`](./WMS_RECEIVING_LINE_VARIANCE_BF01.md) — minimal **ShipmentItem** fields + API (`set_shipment_item_receive_line`); separate **`WmsReceipt`** header still backlog | WMS |
| **BF-02** | **Lot master / serial genealogy** beyond `lotCode` buckets | SKU/UOM/lot row | BF-01 if variance feeds lot splits | [`WMS_LOT_BATCH_BF02.md`](./WMS_LOT_BATCH_BF02.md) — minimal **`WmsLotBatch`** + `set_wms_lot_batch`; per-unit **serial genealogy** still backlog | WMS + catalog |
| **BF-03** | **Allocation engine** — FEFO, solver, wave policies beyond staged profiles | Allocation row | Stable inventory + strategy inputs | [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md) — **`FEFO_BY_LOT_EXPIRY`** for automated waves + `WmsLotBatch`; carton/solver/multi-wave engine still backlog | WMS |
| **BF-04** | **Topology** — parent zones (**BF-04 slice**); aisle entities / geometry hooks backlog | Zone row | migrations | [`WMS_ZONE_PARENT_BF04.md`](./WMS_ZONE_PARENT_BF04.md) — **`WarehouseZone.parentZoneId`** + `set_zone_parent`; **first-class `Aisle` / twin** still backlog per [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md) | WMS |
| **BF-05** | **Dock yard / TMS depth** — carrier + gate milestones beyond WE-02; full TMS backlog | Appointment row | WE-02 dock scheduling | [`WMS_DOCK_YARD_BF05.md`](./WMS_DOCK_YARD_BF05.md) — transport + yard milestones + API; **carrier EDI / TMS solver** still backlog — [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md) | WMS (+ integrations) |
| **BF-06** | **RBAC / scoped mutation tiers** — per-field ACL backlog | Permissions row | roles catalog + BF-06 tier mapping | [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md); tier-aware gates — [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md) | Platform + WMS |
| **BF-07** | **Executive / blueprint KPIs** — OTIF, labor, slotting | Dashboards row | Metric definitions | [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md) — proxies + scope + narratives (**rates**/solver backlog) | Product + WMS |
| **BF-08** | **Packing integration** — GS1 / ZPL / scanner hardware | Packing row | Vendor choices | [`WMS_PACKING_LABELS_BF08.md`](./WMS_PACKING_LABELS_BF08.md) — demo SSCC + ZPL stub (**scanner**/carrier backlog) | WMS |
| **BF-09** | **VAS portal & BOM costing** | VAS row | Commercial assumptions | [`WMS_VAS_BF09.md`](./WMS_VAS_BF09.md) — intake + CRM + estimate snapshots (**multi-line BOM** landed **BF-18**); portal OIDC **BF-46** ([`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md)); SAML backlog | WMS + CRM |
| **BF-10** | **Commercial CPQ → outbound lineage** — optional **`sourceCrmQuoteId`**; BF-14 SKU explosion landed | Commercial row | CRM (+ WMS API) | [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md) — BF-10 quote attribution + CRM handoff; BF-14 **`inventorySku`** + **`explode_crm_quote_to_outbound`** | CRM + WMS |
| **BF-11** | **CT map merged layers** — optional **`Warehouse`** site pins on **`/control-tower/map`**; **BF-19** CRM HQ pins landed; rack floor on CT map backlog | Enterprise CT map row | WE-11 navigation landed | [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md) — **`buildWarehouseMapPins`** + **`GET /api/control-tower/map-pins`** (**BF-11**) | CT + WMS |
| **BF-12** | **Receiving Option B** — **`WmsReceipt`** (or equivalent) header + multi-event dock receipts vs Option A-only shipments | Inbound / receiving row | BF-01 line variance stable | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) §BF-12 + [`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md) | WMS |
| **BF-13** | **Serial / unit genealogy** beyond **`lotCode`** + **`WmsLotBatch`** | SKU / lot row | BF-02 metadata | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) §BF-13 + [`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md) | WMS + catalog |
| **BF-14** | **CPQ → outbound lines** — explode **`CrmQuoteLine`** into **`OutboundOrderLine`** with confirmation | Commercial row | BF-10 lineage | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) §BF-14 + [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md) — **minimal landed** (`inventorySku`, preview/confirm POST, Operations UI); full CPQ backlog | CRM + WMS |
| **BF-15** | **Wave / allocation solver v2** — carton or capacity-aware batching beyond current heuristics | Allocation row | BF-03 strategies | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) §BF-15 + [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md) — **minimal landed** (`GREEDY_MIN_BIN_TOUCHES`, `pickWaveCartonUnits`); MILP backlog | WMS |
| **BF-16** | **Per-field WMS ACL** — matrix beyond BF-06 coarse tiers | Permissions row | BF-06 tiers | Minimal **`org.wms.inventory.lot`** + manifest landed ([`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) §BF-16, [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md)); full blueprint matrix backlog | Platform + WMS |
| **BF-17** | **TMS / carrier stub** — dock refs + Bearer webhook placeholder | Appointments / TMS row | BF-05 dock slice | Minimal landed (`POST /api/wms/tms-webhook`, `set_dock_appointment_tms_refs`, BF-17 columns — [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) §BF-17, [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md)); carrier certify backlog | WMS + integrations |
| **BF-18** | **VAS multi-line BOM** consumption vs single-row **`VALUE_ADD`** | VAS row | BF-09 intake | Minimal landed: **`WmsWorkOrderBomLine`**, **`replace_work_order_bom_lines`**, **`consume_work_order_bom_line`**, WMS UI, **`db:seed:wms-vas-bom-demo`** ([`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) §BF-18, [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md)); MRP/ECO backlog | WMS + CRM |
| **BF-19** | **CT map depth** — **minimal landed:** CRM account lat/lng HQ pins (**not** rack/bin); geocode + indoor map backlog | Enterprise CT map row | BF-11 warehouse pins | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) §BF-19 + [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md) — **`buildCrmAccountMapPins`**, CRM PATCH geo | CT + CRM (+ WMS grants for map) |
| **BF-20** | **Executive KPI rates** — minimal proxy numeric rates + methodology on **`fetchWmsHomeKpis`** | Dashboards row | BF-07 home KPIs | Minimal landed: **`rates`** + **`rateMethodology`** ([`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) §BF-20, [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md)); delivered OTIF % / engineered labor / ABC slotting backlog | Product + WMS |
| **BF-21** | **Receipt accounting & ASN policies** — **minimal landed:** closed **`WmsReceipt`** history + idempotent close + optional **`RECEIPT_COMPLETE`** on close (**BF-31** dock GRN + ASN qty tolerance — [`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md); **BF-32** receiving accrual staging — [`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)) | Inbound / receiving row | BF-12 dock receipt | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-21 + [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md); carrier ASN hub / centralized GRN / ERP GL automation backlog | WMS (+ finance alignment) |
| **BF-22** | **CPQ contracted pricing** on outbound lines beyond SKU map (**BF-14**) — **minimal landed:** **`listUnitPrice`** / **`priceTierLabel`**, resolver + explosion preview + **`OutboundOrderLine.commercial*`** | Commercial row | BF-14 explosion | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-22 + [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md) | CRM + WMS |
| **BF-23** | **Allocation MILP / cube / labor** solver depth beyond **BF-15** heuristics — **minimal landed:** **`GREEDY_RESERVE_PICK_FACE`** + **`WMS_DISABLE_BF23_STRATEGY`** ([`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md)) | Allocation row | BF-15 greedy/cap | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-23 + [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md) | WMS |
| **BF-24** | **First-class Aisle / geometry** per topology ADR — **minimal landed:** **`WarehouseAisle`** + **`WarehouseBin.warehouseAisleId`** + POST **`create_warehouse_aisle`** / **`update_warehouse_aisle`** ([`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md)) | Zone row | BF-04 parents | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-24 + [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md) | WMS |
| **BF-25** | **Production TMS / carrier EDI** beyond **BF-17** stub — **minimal landed:** optional **`TMS_WEBHOOK_HMAC_SECRET`** + **`X-TMS-Signature`**, **`WmsTmsWebhookReceipt`** / **`externalEventId`** ([`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md)) | Appointments / TMS row | BF-17 webhook pattern | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-25 + [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md) | WMS + integrations |
| **BF-26** | **VAS MRP / engineering change** — **minimal landed:** CRM **`engineeringBom*`** on **`CrmQuoteLine`**, WMS **`link_work_order_crm_quote_line`** / **`sync_work_order_bom_from_crm_quote_line`**, estimate variance on **`GET /api/wms`** ([`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md)) | VAS row | BF-18 BOM lines | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-26 + [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md) | WMS + CRM |
| **BF-27** | **CT map indoor / rack pins** — **minimal landed:** **`warehouseBinPins`** near BF-11 warehouse sites (deterministic jitter, cap 200, CT UI toggle) ([`WMS_CT_MAP_BF27.md`](./WMS_CT_MAP_BF27.md)) | Enterprise CT map row | BF-11 sites + BF-19 CRM pins | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-27 + [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md) | CT + WMS |
| **BF-28** | **Billing / invoice depth** (Phase B+) — **minimal landed:** dispute hold on **`WmsBillingEvent`** ([`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md)); accrual / approvals backlog | Billing / Phase B row | Event materialization stable | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-28 + [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md) | Product + WMS |
| **BF-29** | **Packing scanner & carrier label APIs** (**BF-08** depth) — **minimal landed:** multiset scan verify + **`DEMO_PARCEL`** demo adapter ([`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md)) | Packing row | BF-08 ZPL/SSCC | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-29 + [`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md) | WMS + vendors |
| **BF-30** | **Customer portal SSO** — **minimal landed:** **`User.customerPortalExternalSubject`**, **`POST /api/auth/customer-portal/sso`** (simulate + HMAC), VAS **`request_customer_vas_work_order`** CRM guard + intake UI lock ([`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md)); **BF-46** OIDC authorization-code + PKCE + JWKS ([`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md)); SAML backlog | Portal row | BF-09 intake | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-30 + [`WMS_VAS_BF09.md`](./WMS_VAS_BF09.md) | Platform + CRM |
| **BF-31** | **GRN + ASN qty tolerance** — **minimal landed:** **`Shipment.asnQtyTolerancePct`**, **`WmsReceipt.grnReference`**, **`evaluate_wms_receipt_asn_tolerance`**, guarded **`close_wms_receipt`** ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)) | Inbound / receiving row | BF-21 | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) §BF-31 + [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md) | WMS (+ finance alignment) |
| **BF-32** | **Receiving accrual staging** — **minimal landed:** **`WmsReceivingAccrualStaging`** on **`close_wms_receipt`**, **`GET /api/wms/receiving-accrual-staging`** (JSON + CSV), billing workspace preview ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)) | Inbound / receiving + Phase B billing row | BF-21 / BF-31 | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) §BF-32 + [`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md) | WMS (+ finance alignment) |

**Note:** IDs are **not** commitments — merge/split capsules when estimates land (e.g. **BF-02 + BF-01** often sequenced tightly).

**Do not bundle **`BF-02`–`BF-11`**, **`BF-12`–`BF-20`**, nor **`BF-21`–`BF-32`** into one prompt:** each row is a **separate** thematic capsule. Mega-phase definitions: [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) (BF-12–BF-20), [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) (BF-21–BF-30), [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) (BF-31–BF-50).

**If your goal is receiving line variance:** use capsule **`BF-01`** — not **`BF-03`**, **`BF-04`**, **`BF-05`**, or **`BF-06`**. Those IDs mean **allocation depth** ([`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md)), **zone topology** ([`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md)), **dock / TMS depth** ([`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md)), and **WMS RBAC depth** ([`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md), [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md)).

---

## Exit definition (“blueprint finish”)

“Done” for **this backlog** means:

1. Each **R1–R3 + Enterprise** row in [`GAP_MAP.md`](./GAP_MAP.md) is either **✅** or **🟡** with an explicit **documented limit** (ADR or row note), **or** consciously **❌** with product **won’t-do** recorded.
2. **Explicitly deferred** paragraph at top of **`GAP_MAP`** is emptied or rewritten to match **only** post-R3 / future program items ([`CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](../engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md)).

---

## Next step

1. See **`BF-02` … `BF-11`** recommended order and capsule cards — [`BF_CAPSULE_ROADMAP.md`](./BF_CAPSULE_ROADMAP.md).
2. For **`BF-12` … `BF-20`** mega-phase objectives and prompt stubs — [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md).
3. For **`BF-21` … `BF-30`** next-wave objectives — shipped minimal slices in [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md); **`BF-31`** onward — [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md); catalog rows in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md).
4. Product prioritizes **`BF-xx`** order (or swaps Phase A/B/C above).
5. Open **one capsule** → **`GAP_MAP`** delta → ship → repeat.

---

## Example prompt — **BF-01** (copy/paste)

**What it is:** **Line-level receiving variance** (expected vs received per line, short/over and disposition) — thin **Option A** extension on **`ShipmentItem`** ([`WMS_RECEIVING_LINE_VARIANCE_BF01.md`](./WMS_RECEIVING_LINE_VARIANCE_BF01.md)); shipment-level **`WmsReceiveStatus`** stays [`WMS_RECEIVING_OPTION_A.md`](./WMS_RECEIVING_OPTION_A.md). See **`§ Options A/B/C`** in [`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md); separate **`WmsReceipt`** header / Option **B** lines remain backlog unless product funds migration.

```
Execute blueprint capsule BF-01 per docs/wms/BLUEPRINT_FINISH_BACKLOG.md.

Goal: Ship a minimal receiving line variance slice (expected vs received per inbound line + disposition/notes), choosing schema approach per docs/wms/WMS_RECEIVING_STATE_MACHINE_SPEC.md — prefer documenting Option B (header + lines) or a thin extension of Option A if product wants smallest migration.

Constraints:
- Respect typical allowed paths in docs/engineering/agent-todos/wms.md for WMS; flag any unavoidable CRM/shared touches.
- Migrations + prisma validate; seeds/demo notes if new rows — docs/database-neon.md pattern.

Deliverables:
- Schema/API/UI aligned to the chosen option; audit lines where transitions matter.
- Update docs/wms/GAP_MAP.md (Inbound ASN row + _Last updated_) and add/adjust docs/wms/* spec or ADR for residual limits.
- Vitest for new pure logic in src/lib/wms/** where applicable.

Exit when BF-01 row in BLUEPRINT_FINISH_BACKLOG.md is satisfied: GAP_MAP reflects line variance depth or explicit documented deferral for remaining gaps.
```

_Last updated: 2026-04-29 — **BF-46** customer portal OIDC minimal ([`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md)); **2026-05-08** — **BF-32** receiving accrual staging minimal ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)); **BF-31** GRN + ASN qty tolerance minimal ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)); **BF-30** customer portal SSO minimal ([`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md)); **BF-25** TMS webhook HMAC + idempotency minimal ([`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md)); **BF-24** first-class aisles minimal (`WarehouseAisle`, [`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md)); **BF-23** allocation reserve pick-face minimal ([`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md)); **BF-22** CPQ contracted pricing minimal ([`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md)); **`BF-21`–`BF-30`** catalog rows + [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md); **2026-05-02** — **BF-20** KPI proxy rates landed; **`BF-12`–`BF-20`** in [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md); **`BF-02`–`BF-46`** [`BF_CAPSULE_ROADMAP.md`](./BF_CAPSULE_ROADMAP.md); BF-01 prompt template._
