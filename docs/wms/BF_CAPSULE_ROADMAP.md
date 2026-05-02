# Blueprint finish (`BF-xx`) — roadmap after BF-01

**Purpose:** Track **blueprint-finish capsules** after **`BF-01`**: **Done** table (**`BF-02` … `BF-52`** minimal slices where noted), **draft program** **`BF-53` … `BF-70`** ([`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md)), mega-phase definitions ([`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md)), capsule cards, and how to execute prompts — see [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md), [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), and [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md).

**Authority:** Capsule IDs and themes match [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). **`GAP_MAP.md`** stays the repo ↔ blueprint truth.

**Typical WMS paths:** [`docs/engineering/agent-todos/wms.md`](../engineering/agent-todos/wms.md) — stay inside `src/app/wms/**`, `src/app/api/wms/**`, `src/lib/wms/**` unless an issue explicitly allows CRM/CT/shared touches.

---

## Done

| ID | Theme | Notes |
|----|--------|--------|
| **BF-01** | Receiving line variance | Thin **`ShipmentItem`** counts + disposition via `set_shipment_item_receive_line` — [`WMS_RECEIVING_LINE_VARIANCE_BF01.md`](./WMS_RECEIVING_LINE_VARIANCE_BF01.md); optional **`WmsReceipt`** dock session wrapper — **BF-12** |
| **BF-02** | Lot / batch master (metadata) | **`WmsLotBatch`** + `set_wms_lot_batch`; unit-level serials → **BF-13** — [`WMS_LOT_BATCH_BF02.md`](./WMS_LOT_BATCH_BF02.md) |
| **BF-03** | Allocation depth (FEFO) | **`FEFO_BY_LOT_EXPIRY`** on waves + tests — [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md); **BF-15** greedy + unit cap minimal; **BF-23** reserve pick-face tie-break — [`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md); MILP/carton cube backlog |
| **BF-04** | Zone parent hierarchy (DAG) | **`WarehouseZone.parentZoneId`** + `set_zone_parent` + Setup UI — [`WMS_ZONE_PARENT_BF04.md`](./WMS_ZONE_PARENT_BF04.md); **BF-24** aisle masters — [`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md); **BF-50** topology JSON export — [`WMS_TOPOLOGY_BF50.md`](./WMS_TOPOLOGY_BF50.md); live twin runtime backlog — [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md) |
| **BF-05** | Dock yard ops slice | **`WmsDockAppointment`** carrier/trailer + **`record_dock_appointment_yard_milestone`** — [`WMS_DOCK_YARD_BF05.md`](./WMS_DOCK_YARD_BF05.md); **BF-17** TMS webhook + **BF-25** HMAC/idempotency — [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md); vendor certify backlog |
| **BF-06** | WMS scoped RBAC tiers | **`org.wms.setup` / `operations` / `inventory`** + `gateWmsPostMutation` — [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md); **BF-16** **`org.wms.inventory.lot`** — [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md); **BF-48** **`org.wms.inventory.serial`** + manifest — [`WMS_RBAC_BF48.md`](./WMS_RBAC_BF48.md) |
| **BF-07** | Executive / blueprint KPIs | WE-09 + proxies/narratives + optional **`wh`** scope — [`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md), [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md); **BF-20** adds **`rates`** on **`fetchWmsHomeKpis`**; delivered OTIF % / engineered labor / ABC slotting backlog |
| **BF-08** | Packing GS1/ZPL integration stub | Demo SSCC + ship-station **ZPL** download — [`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md), [`WMS_PACKING_LABELS_BF08.md`](./WMS_PACKING_LABELS_BF08.md); **BF-29** adds scan verify + **`DEMO_PARCEL`** label ([`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md)); scanner wedge + vendor purchase APIs backlog |
| **BF-09** | VAS portal intake & estimates | **`/wms/vas-intake`**, CRM link + **`CUSTOMER_PORTAL`** WO + commercial cents/min ([`WMS_VAS_BF09.md`](./WMS_VAS_BF09.md)); **BF-18** multi-line BOM snapshot + consume ([`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md)); **BF-30** SSO bridge + CRM lock ([`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md)); **BF-46** OIDC env-driven login ([`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md)); SAML backlog |
| **BF-10** | CRM quote → outbound lineage | **`OutboundOrder.sourceCrmQuoteId`**, CRM handoff link + WMS picker ([`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md)); **BF-14** SKU explosion |
| **BF-11** | CT map WMS warehouse sites | Optional **■ warehouse pins** on **`/control-tower/map`** when **`org.wms` → view ([`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md)); **BF-19** CRM HQ ◆ pins when **`org.crm` → view`; **BF-27** ▲ approximate bin scatter near sites ([`WMS_CT_MAP_BF27.md`](./WMS_CT_MAP_BF27.md)); surveyed CAD footprints backlog |
| **BF-12** | Receiving Option B (dock receipt session) | **`WmsReceipt`** / **`WmsReceiptLine`**, `create_wms_receipt` / `close_wms_receipt` / `set_wms_receipt_line` + inbound UI — [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md); **BF-21** adds history + idempotent close + optional **`RECEIPT_COMPLETE`** — [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md); **BF-31** GRN + ASN qty tolerance — [`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md); **BF-32** receiving accrual staging snapshot — [`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md); carrier ASN hub auto-close backlog |
| **BF-13** | Serial / unit genealogy | **`WmsInventorySerial`** / **`WmsInventorySerialMovement`**, register/balance/attach POST actions + **trace** query — [`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md); automation from handlers / full GS1 still backlog |
| **BF-14** | CPQ quote lines → outbound | **`CrmQuoteLine.inventorySku`**, **`explode_crm_quote_to_outbound`**, CRM + Operations UI — [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md); **BF-22** list/tier + **`commercial*`** snapshots — [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md); full CPQ solver backlog |
| **BF-15** | Wave allocation v2 (minimal) | **`GREEDY_MIN_BIN_TOUCHES`** + **`pickWaveCartonUnits`** + Setup UI — [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md); MILP / cube / labor-aware backlog |
| **BF-17** | TMS dock stub (minimal) | **`tmsLoadId` / `tmsCarrierBookingRef`**, **`POST /api/wms/tms-webhook`**, `set_dock_appointment_tms_refs` — [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md); **BF-25** extends webhook — [`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md); vendor certify backlog |
| **BF-18** | VAS multi-line BOM (minimal) | **`WmsWorkOrderBomLine`**, **`replace_work_order_bom_lines`**, **`consume_work_order_bom_line`** — [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md); automated BOM/MRP backlog |
| **BF-19** | CT map CRM HQ pins (minimal) | **`CrmAccount.mapLatitude` / `mapLongitude`**, **`crmAccountPins`** on **`GET /api/control-tower/map-pins`**, CRM account workspace save — [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md); geocode / rack-floor map backlog |
| **BF-20** | Executive KPI rates (minimal) | **`buildExecutiveRates`** + **`rates`** / **`rateMethodology`** on **`fetchWmsHomeKpis`**, `/wms` executive cards — [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md); delivered OTIF % / engineered labor / ABC slotting backlog |
| **BF-21** | Receipt accounting (minimal) | **`closedWmsReceiptHistory`**, idempotent **`close_wms_receipt`**, **`receiptCompleteOnClose`** — [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md); **BF-31** dock GRN + ASN qty tolerance — [`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md); **BF-32** accrual staging on close — [`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md); carrier ASN hub backlog |
| **BF-22** | CPQ contracted pricing (minimal) | **`listUnitPrice`** / **`priceTierLabel`** on **`CrmQuoteLine`**, **`resolveQuoteLineCommercialPricing`**, explosion preview + **`OutboundOrderLine.commercial*`** — [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md); external price books / ladders backlog |
| **BF-23** | Allocation reserve pick-face (minimal) | **`GREEDY_RESERVE_PICK_FACE`** + **`WarehouseBin.isPickFace`** tie-break on **`GREEDY_MIN_BIN_TOUCHES`** ordering — [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md); MILP / labor heatmaps / unified slotting backlog |
| **BF-24** | Aisle / geometry hooks (minimal) | **`WarehouseAisle`** + **`WarehouseBin.warehouseAisleId`** + POST **`create_warehouse_aisle`** / **`update_warehouse_aisle`** + mm columns — [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md); **BF-50** exports aisle/bin graph JSON ([`WMS_TOPOLOGY_BF50.md`](./WMS_TOPOLOGY_BF50.md)); AGV runtime / twin meshes backlog |
| **BF-25** | TMS webhook production hooks (minimal) | Optional **`TMS_WEBHOOK_HMAC_SECRET`** + **`X-TMS-Signature`**, **`WmsTmsWebhookReceipt`** / **`externalEventId`** — [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md); JWT/mTLS / DLQ backlog |
| **BF-26** | VAS engineering BOM sync (minimal) | **`CrmQuoteLine.engineeringBom*`**, **`link_work_order_crm_quote_line`**, **`sync_work_order_bom_from_crm_quote_line`**, variance on **`GET /api/wms`** — [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md); PLM webhook / partial ECO backlog |
| **BF-27** | CT indoor bin scatter (minimal) | **`warehouseBinPins`** near BF-11 sites + CT toggle ([`WMS_CT_MAP_BF27.md`](./WMS_CT_MAP_BF27.md), [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md)); CAD / RTLS backlog |
| **BF-28** | Billing dispute hold (minimal) | **`billingDisputed`** / **`billingDisputeNote`** on **`WmsBillingEvent`**, **`set_billing_event_dispute`**, draft runs skip held rows ([`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md)); **BF-47** posted-run **POST_DISPUTED** + credit memo stubs ([`WMS_BILLING_BF47.md`](./WMS_BILLING_BF47.md)); accrual / full AR backlog |
| **BF-29** | Packing scan + demo carrier (minimal) | **`validate_outbound_pack_scan`**, env **`WMS_REQUIRE_PACK_SCAN`** / **`WMS_REQUIRE_SHIP_SCAN`**, **`request_demo_carrier_label`** ([`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md)); vendor certify backlog |
| **BF-30** | Customer portal SSO (minimal) | **`customerPortalExternalSubject`**, **`POST /api/auth/customer-portal/sso`**, VAS intake/API CRM lock ([`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md)); **BF-46** OIDC discovery + PKCE + JWKS **`id_token`** verify ([`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md)); SAML backlog |
| **BF-31** | GRN + ASN qty tolerance (minimal) | **`asnQtyTolerancePct`**, **`evaluate_wms_receipt_asn_tolerance`**, **`WmsReceipt.grnReference`**, guarded close ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)); carrier ASN hub backlog |
| **BF-32** | Receiving accrual staging (minimal) | **`WmsReceivingAccrualStaging`** + **`GET /api/wms/receiving-accrual-staging`** ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)); ERP GL posting backlog |
| **BF-39** | Carrier label purchase (minimal) | **`purchase_carrier_label`** + env router + HTTP JSON bridge + **`OutboundOrder.carrier*`** ([`WMS_CARRIER_LABEL_BF39.md`](./WMS_CARRIER_LABEL_BF39.md)); vendor SDK certify backlog |
| **BF-40** | Outbound ASN / DESADV export (minimal) | **`GET /api/wms/outbound-asn-export`** + DESADV-inspired JSON ([`WMS_OUTBOUND_ASN_BF40.md`](./WMS_OUTBOUND_ASN_BF40.md)); EDI certify / partner **`POST`** notify via **BF-44** ([`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md)) |
| **BF-41** | Customer returns / RMA receiving (minimal) | **`Shipment.wmsInboundSubtype`** + RMA + optional **`returnSourceOutboundOrderId`**, **`ShipmentItem.wmsReturnDisposition`**, putaway/hold policy ([`WMS_RETURNS_BF41.md`](./WMS_RETURNS_BF41.md)); refund automation backlog |
| **BF-42** | QA sampling / disposition templates (minimal) | **`WmsReceivingDispositionTemplate`** + line QA hints + **`apply_wms_disposition_template_to_shipment_item`** ([`WMS_QA_SAMPLING_BF42.md`](./WMS_QA_SAMPLING_BF42.md)); LIMS / enforced AQL backlog |
| **BF-44** | Outbound webhooks (minimal) | **`WmsOutboundWebhookSubscription`** + signed **`POST`** + delivery rows + Setup UI ([`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md)); cron retries ([`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md)) |
| **BF-45** | Partner REST reads (minimal) | **`WmsPartnerApiKey`** + **`GET /api/wms/partner/v1/*`** + [`openapi-partner-v1.yaml`](./openapi-partner-v1.yaml) ([`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md)); enforced rate limits backlog |
| **BF-46** | Customer portal OIDC (minimal) | **`GET /api/auth/customer-portal/oidc/start`** / **`callback`**, PKCE + JWKS **`id_token`** verify, same **`po_auth_user`** session as BF-30 ([`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md)); SAML backlog |
| **BF-47** | Posted billing disputes & credit stubs (minimal) | **`POST_DISPUTED`** invoice runs, **`WmsBillingCreditMemoStub`**, **`set_invoice_run_posted_dispute`**, **`create_billing_credit_memo_stub`**, BF-44 webhooks ([`WMS_BILLING_BF47.md`](./WMS_BILLING_BF47.md)); tax reversal / AR subledger backlog |
| **BF-48** | Inventory field ACL matrix / **`inventory.serial`** (minimal) | **`wms-field-acl-matrix.json`**, **`org.wms.inventory.serial`**, **`evaluateWmsInventoryPostMutationAccess`**, Stock **`inventorySerialEdit`** ([`WMS_RBAC_BF48.md`](./WMS_RBAC_BF48.md)); external PDP / SQL matrix backlog |
| **BF-49** | Unified ops timeline / audit feed (minimal) | **`GET /api/control-tower/timeline`**, **`OperationalTimelineFeed`** on **`/control-tower`** + **`/wms`** ([`WMS_OPERATIONS_TIMELINE_BF49.md`](./WMS_OPERATIONS_TIMELINE_BF49.md)); SIEM export backlog |
| **BF-50** | Topology graph export / twin-readiness (minimal) | **`GET /api/wms?topologyGraph=1`**, **`export_warehouse_topology_graph`**, **`warehouse-topology-graph.ts`** + Vitest + Setup download ([`WMS_TOPOLOGY_BF50.md`](./WMS_TOPOLOGY_BF50.md)); live AGV orchestration / Unity-Unreal twin backlog |
| **BF-51** | Structured cycle counts / variance approval (minimal) | **`WmsCycleCountSession`** / **`WmsCycleCountLine`** + **`submit_cycle_count`** / **`approve_cycle_count_variance`** + **`GET /api/wms`** **`cycleCountSessions`** ([`WMS_CYCLE_COUNT_BF51.md`](./WMS_CYCLE_COUNT_BF51.md)); legacy **`CYCLE_COUNT`** tasks unchanged; RFID / ERP PI backlog |
| **BF-52** | Slotting ABC / velocity recommendations (minimal) | **`GET /api/wms/slotting-recommendations`** (JSON + CSV) + Setup preview ([`WMS_SLOTTING_BF52.md`](./WMS_SLOTTING_BF52.md)); robot solver + auto-relocate tasks backlog |

---

## Draft program (`BF-53` … `BF-70`)

**Status:** **Draft IDs only** — no in-repo minimal slices yet; product may reorder/merge/split before execution. Program rollup + exit sketches: [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md). Catalog rows: [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md).

| ID | Theme (short) |
|----|----------------|
| **BF-53** | Labor standards & task timing capture |
| **BF-54** | Yard detention & trailer clock alerts |
| **BF-55** | Stock transfer orders & in-transit ledger |
| **BF-56** | Batch / cluster pick waves |
| **BF-57** | Nested LU aggregation & SSCC validation depth |
| **BF-58** | Inventory freeze matrix expansion |
| **BF-59** | Inbound ASN pre-advise ingestion stub |
| **BF-60** | Mobile offline scan queue replay |
| **BF-61** | Forecast-driven replenishment hints |
| **BF-62** | Kit assembly / build-to-order postings |
| **BF-63** | Catch-weight receiving |
| **BF-64** | Cold-chain custody segments on movements |
| **BF-65** | Damage workflow & carrier claim export stub |
| **BF-66** | Voice-picking JSON protocol stub |
| **BF-67** | Multi-parcel outbound manifests |
| **BF-68** | Customs filing export JSON handoff |
| **BF-69** | Carbon intensity hints on movements |
| **BF-70** | External PDP authorization hooks |

---

## Recommended order (adjust with product)

Order follows [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md) **Phase A → E**: inventory truth before execution engines; topology/yard before throwing integrations at cross-product epics.

**Blueprint finish capsules `BF-02` … `BF-11` are complete in this roadmap snapshot.** **`BF-12`** … **`BF-52`** have **minimal slices shipped** in-repo where noted ([`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_CYCLE_COUNT_BF51.md`](./WMS_CYCLE_COUNT_BF51.md), [`WMS_SLOTTING_BF52.md`](./WMS_SLOTTING_BF52.md); catalog rows in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md)). **`BF-53`** … **`BF-70`** are **draft program placeholders** only ([`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md)). Further enterprise depth → [`CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](../engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md).

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
| 12 | **BF-23** | B — Allocation depth | ✅ **Minimal landed** — **`GREEDY_RESERVE_PICK_FACE`** + **`WarehouseBin.isPickFace`** ([`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md)) |
| 13 | **BF-24** | B — Topology | ✅ **Minimal landed** — **`WarehouseAisle`** + bin **`warehouseAisleId`** ([`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md)) |
| 14 | **BF-25** | C — Integrations | ✅ **Minimal landed** — TMS webhook HMAC + **`externalEventId`** ([`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md)) |
| 15 | **BF-26** | R3 — VAS depth | ✅ **Minimal landed** — CRM engineering BOM JSON + **`sync_work_order_bom_from_crm_quote_line`** ([`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md)) |
| 16 | **BF-27** | Enterprise map | ✅ **Minimal landed** — **`warehouseBinPins`** scatter + CT map toggle ([`WMS_CT_MAP_BF27.md`](./WMS_CT_MAP_BF27.md)) |
| 17 | **BF-28** | R3 — Billing depth | ✅ **Minimal landed** — dispute hold on billing events ([`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md)) |
| 18 | **BF-29** | R2 — Packing depth | ✅ **Minimal landed** — scan verify + demo carrier ZPL ([`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md)) |
| 19 | **BF-30** | R3 — Portal identity | ✅ **Minimal landed** — SSO bridge + VAS CRM lock ([`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md)) |
| 20 | **BF-31** | A — Receiving depth | ✅ **Minimal landed** — GRN + ASN qty tolerance ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)) |
| 21 | **BF-32** | A — Receiving / finance handoff | ✅ **Minimal landed** — accrual staging + CSV export ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)) |
| 22 | **BF-39** | R2 — Packing / carrier | ✅ **Minimal landed** — `purchase_carrier_label` + HTTP JSON bridge + persisted tracking ([`WMS_CARRIER_LABEL_BF39.md`](./WMS_CARRIER_LABEL_BF39.md)) |
| 23 | **BF-40** | R2 — Ship notice export | ✅ **Minimal landed** — `GET /api/wms/outbound-asn-export` + DESADV-inspired JSON ([`WMS_OUTBOUND_ASN_BF40.md`](./WMS_OUTBOUND_ASN_BF40.md)) |
| 24 | **BF-41** | A — Returns receiving | ✅ **Minimal landed** — customer-return subtype + RMA + line disposition + putaway/hold hooks ([`WMS_RETURNS_BF41.md`](./WMS_RETURNS_BF41.md)) |
| 25 | **BF-42** | A — Receiving QA templates | ✅ **Minimal landed** — disposition templates + line sampling + apply note ([`WMS_QA_SAMPLING_BF42.md`](./WMS_QA_SAMPLING_BF42.md)) |
| 26 | **BF-43** | R2 — Outbound logistics units | ✅ **Minimal landed** — nested LU rows + BF-29 multiset substitution ([`WMS_LOGISTICS_UNITS_BF43.md`](./WMS_LOGISTICS_UNITS_BF43.md)) |
| 27 | **BF-44** | C — Integrations / callbacks | ✅ **Minimal landed** — tenant webhook subscriptions + HMAC body signing + delivery ledger + cron retries ([`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md)) |
| 28 | **BF-45** | C — Partner reads | ✅ **Minimal landed** — API keys + **`GET /api/wms/partner/v1/*`** + OpenAPI stub ([`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md)) |
| 29 | **BF-46** | R3 — Portal identity | ✅ **Minimal landed** — OIDC authorization-code + PKCE + JWKS **`id_token`** verify ([`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md)) |
| 30 | **BF-47** | R3 — Billing / finance hooks | ✅ **Minimal landed** — **POST_DISPUTED** runs + credit memo stubs + webhooks ([`WMS_BILLING_BF47.md`](./WMS_BILLING_BF47.md)) |
| 31 | **BF-48** | D — Governance / ACL matrix | ✅ **Minimal landed** — **`wms-field-acl-matrix.json`** + **`org.wms.inventory.serial`** + Stock UI gates ([`WMS_RBAC_BF48.md`](./WMS_RBAC_BF48.md)) |
| 32 | **BF-49** | D — Ops timeline | ✅ **Minimal landed** — **`GET /api/control-tower/timeline`** + **`OperationalTimelineFeed`** ([`WMS_OPERATIONS_TIMELINE_BF49.md`](./WMS_OPERATIONS_TIMELINE_BF49.md)) |
| 33 | **BF-50** | B — Topology export | ✅ **Minimal landed** — warehouse aisle/bin graph JSON + adjacent-slot edges ([`WMS_TOPOLOGY_BF50.md`](./WMS_TOPOLOGY_BF50.md)) |
| 34 | **BF-51** | A — Cycle count depth | ✅ **Minimal landed** — structured sessions + submit/approve variance ([`WMS_CYCLE_COUNT_BF51.md`](./WMS_CYCLE_COUNT_BF51.md)) |
| 35 | **BF-52** | D — Slotting advisory | ✅ **Minimal landed** — `GET /api/wms/slotting-recommendations` + Setup preview ([`WMS_SLOTTING_BF52.md`](./WMS_SLOTTING_BF52.md)) |

**Parallelization:** historical note — **BF-04** / **BF-05** / commercial (**BF-10**) often ran in parallel when teams differed.

---

## Capsule cards (`BF-02` … `BF-52`)

Use one row as the **scope box** before filing GitHub issues or agent prompts.

| ID | `GAP_MAP` signal | Primary docs | Shared / CRM / CT? | Status |
|----|------------------|--------------|---------------------|--------|
| **BF-02** | SKU / UOM / lot | [`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md), [`WMS_LOT_BATCH_BF02.md`](./WMS_LOT_BATCH_BF02.md) | Catalog overlap (`Product`); else WMS | **Partial** — `WmsLotBatch` + UI + **BF-13** serial slice |
| **BF-03** | Allocation | [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md), [`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md) | WMS-only core | **Partial** — **`FEFO_BY_LOT_EXPIRY`** + fungible/FIFO/MAX + **BF-15** greedy/cap + **BF-23** reserve pick-face; MILP backlog |
| **BF-04** | Zone / aisle | [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md), [`WMS_ZONE_PARENT_BF04.md`](./WMS_ZONE_PARENT_BF04.md), [`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md), [`WMS_TOPOLOGY_BF50.md`](./WMS_TOPOLOGY_BF50.md) | WMS | **Partial** — **`parentZoneId`** + `set_zone_parent` + UI + **BF-24** **`WarehouseAisle`** + bin links + **BF-50** topology JSON; live twin runtime backlog |
| **BF-05** | Appointments / TMS | [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md), [`WMS_DOCK_YARD_BF05.md`](./WMS_DOCK_YARD_BF05.md), [`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md) | Integrations | **Partial** — WE-02 + BF-05 yard + **BF-17** stub + **BF-25** HMAC/idempotency; vendor certify backlog |
| **BF-06** | Permissions | [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md), [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md), [`WMS_RBAC_BF48.md`](./WMS_RBAC_BF48.md) | **Platform + auth** | **Partial** — BF-06 tier grants + action map; **BF-16** `inventory.lot`; **BF-48** manifest + `inventory.serial`; full SQL matrix backlog |
| **BF-07** | Dashboards | [`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md), [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md) | Product + WMS | **Partial** — WE-09 + BF-07 proxies/narratives + **BF-20** rate fields; delivered OTIF % / engineered labor / ABC backlog |
| **BF-08** | Packing | [`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md), [`WMS_PACKING_LABELS_BF08.md`](./WMS_PACKING_LABELS_BF08.md), [`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md), [`WMS_CARRIER_LABEL_BF39.md`](./WMS_CARRIER_LABEL_BF39.md), [`WMS_OUTBOUND_ASN_BF40.md`](./WMS_OUTBOUND_ASN_BF40.md) | Vendors / hardware | **Partial** — WE-06 pack/ship + BF-08 ZPL + demo SSCC; **BF-29** scan + demo carrier ZPL; **BF-39** persisted purchase + HTTP bridge; **BF-40** ASN JSON export; carrier certify backlog |
| **BF-09** | VAS | [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md), [`WMS_VAS_BF09.md`](./WMS_VAS_BF09.md), [`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md), [`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md), [`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md) | Portal + commercial assumptions | **Partial** — WE-04 + BF-09 intake + **BF-18** BOM lines + **BF-26** CRM engineering sync + **BF-30** SSO-shaped bridge / CRM lock + **BF-46** OIDC; SAML / full MRP backlog |
| **BF-10** | Commercial | [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md) | **CRM + commercial** | Partial — bill-to + **`sourceCrmQuoteId`** lineage + **BF-14** SKU explosion |
| **BF-11** | Enterprise CT map | [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md), [`WMS_CT_MAP_BF27.md`](./WMS_CT_MAP_BF27.md) | **CT + WMS + CRM** | **Partial** — WE-11 links + **BF-11** warehouse pins + **BF-19** CRM HQ + **BF-27** approximate bin scatter; surveyed CAD indoor tiles ❌ |
| **BF-12** | Receiving Option B | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md) | WMS | **Partial** — `WmsReceipt` session + line posts + **BF-21** history / close policy |
| **BF-13** | Serial / genealogy | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md) | WMS | **Partial** — registry + trace + Stock UI; handler automation backlog |
| **BF-14** | Quote → outbound lines | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md) | **CRM + WMS** | **Partial** — SKU column + explosion POST + preview UI + **BF-22** list/tier pricing; CPQ solver backlog |
| **BF-15** | Wave allocation v2 | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md) | WMS | **Partial** — greedy min-touch + optional unit cap; **BF-23** extends with pick-face reserve ordering; solver backlog |
| **BF-16** | Lot vs qty inventory ACL | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md) | Platform + WMS | **Partial** — `org.wms.inventory.lot` + manifest; broader matrix backlog |
| **BF-17** | TMS dock stub | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md), [`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md) | Integrations + WMS | **Partial** — Bearer webhook + dock columns + **BF-25** signing/idempotency; JWT/mTLS backlog |
| **BF-18** | VAS BOM lines | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md), [`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md) | WMS | **Partial** — snapshot + consumption postings + UI + **BF-26** CRM sync; full MRP backlog |
| **BF-19** | CT CRM map pins | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md) | CT + CRM | **Partial** — explicit account lat/lng + map layer; automatic geocode backlog |
| **BF-20** | Executive KPI rates | [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md) | Product + WMS | **Partial** — proxy **`rates`** + methodology strings; full analytics backlog |
| **BF-21** | Receipt accounting | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md), [`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md), [`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md) | WMS | **Partial** — closed receipt history + idempotent close + optional status advance + **BF-31** GRN / ASN tolerance + **BF-32** staging export; carrier ASN feed backlog |
| **BF-22** | CPQ contracted pricing | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md) | **CRM + WMS** | **Partial** — list vs contract on quote lines + resolver + outbound snapshots; external price books backlog |
| **BF-23** | Reserve pick-face allocation | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md) | WMS | **Partial** — **`GREEDY_RESERVE_PICK_FACE`** + bin **`isPickFace`**; MILP / labor heatmaps backlog |
| **BF-24** | Aisle masters | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md), [`WMS_TOPOLOGY_BF50.md`](./WMS_TOPOLOGY_BF50.md) | WMS | **Partial** — **`WarehouseAisle`** + bin FK + mm ints + POST actions + **BF-50** graph export; AGV runtime backlog |
| **BF-25** | TMS webhook hardening | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md) | Integrations + WMS | **Partial** — HMAC body verify + **`WmsTmsWebhookReceipt`**; DLQ / certify backlog |
| **BF-26** | VAS CRM engineering BOM | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md) | **CRM + WMS** | **Partial** — PATCH quote line JSON + WMS sync + variance stub; PLM webhook / partial ECO backlog |
| **BF-27** | CT bin scatter pins | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_CT_MAP_BF27.md`](./WMS_CT_MAP_BF27.md) | **CT + WMS** | **Partial** — **`warehouseBinPins`** API + map toggle; CAD footprints / RTLS backlog |
| **BF-28** | Billing disputes | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md), [`WMS_BILLING_BF47.md`](./WMS_BILLING_BF47.md), [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md) | WMS + finance alignment | **Partial** — uninvoiced dispute hold + UI + KPI excludes held rows + **BF-47** posted disputes / stubs; full AR / tax reversal backlog |
| **BF-29** | Packing scan / carrier demo | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md), [`WMS_PACKING_LABELS_BF08.md`](./WMS_PACKING_LABELS_BF08.md) | WMS + vendors | **Partial** — multiset scan + env gates + **`DEMO_PARCEL`** ZPL; purchase APIs / certify backlog |
| **BF-30** | Customer portal SSO | [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md), [`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md), [`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md), [`WMS_VAS_BF09.md`](./WMS_VAS_BF09.md) | Platform + CRM | **Partial** — HMAC/simulate SSO bridge + **`customerPortalExternalSubject`** + VAS CRM lock + **BF-46** OIDC; SAML backlog |
| **BF-31** | GRN / ASN tolerance | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md), [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md) | WMS | **Partial** — dock receipt **GRN**, qty %-tolerance evaluate + close guards; ASN feed auto-close backlog |
| **BF-32** | Receiving accrual staging | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md), [`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md) | WMS + finance alignment | **Partial** — **`WmsReceivingAccrualStaging`** + **`GET /api/wms/receiving-accrual-staging`**; ERP posting backlog |
| **BF-37** | Cross-dock / flow-through tags | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_CROSS_DOCK_BF37.md`](./WMS_CROSS_DOCK_BF37.md) | WMS | **Partial** — **`Shipment.wmsCrossDock` / `wmsFlowThrough`**, **`WarehouseBin.isCrossDockStaging`**, allocation staging-first tie-break, Operations filter + bin create UI |
| **BF-38** | Dock door & trailer checklist | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_DOCK_BF38.md`](./WMS_DOCK_BF38.md), [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md) | WMS | **Partial** — **`WmsDockAppointment.doorCode`** / **`trailerChecklistJson`**, milestone guards, **`nextDockAppointmentWindowStart`** hint + Operations UI |
| **BF-39** | Carrier label purchase | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_CARRIER_LABEL_BF39.md`](./WMS_CARRIER_LABEL_BF39.md), [`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md) | Integrations | **Partial** — **`purchase_carrier_label`** + env router + **`OutboundOrder.carrier*`** + audit; vendor SDK certify backlog |
| **BF-40** | Outbound ASN / DESADV JSON | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_OUTBOUND_ASN_BF40.md`](./WMS_OUTBOUND_ASN_BF40.md), [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md) | ERP / EDI partners | **Partial** — **`GET /api/wms/outbound-asn-export`** + snapshot builder + Ops UI; certified EDIFACT/X12 backlog; partner notify via **BF-44** ([`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md)) |
| **BF-41** | Customer returns / RMA receiving | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_RETURNS_BF41.md`](./WMS_RETURNS_BF41.md), [`WMS_RECEIVING_LINE_VARIANCE_BF01.md`](./WMS_RECEIVING_LINE_VARIANCE_BF01.md) | WMS | **Partial** — inbound subtype + RMA + outbound lineage + line disposition + putaway blocks / quarantine hold; refund orchestration backlog |
| **BF-42** | QA sampling / disposition templates | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_QA_SAMPLING_BF42.md`](./WMS_QA_SAMPLING_BF42.md), [`WMS_RECEIVING_LINE_VARIANCE_BF01.md`](./WMS_RECEIVING_LINE_VARIANCE_BF01.md) | WMS | **Partial** — tenant templates + tokenized variance notes + line QA hints; LIMS / enforced AQL backlog |
| **BF-43** | GS1 license plate / nested outbound LUs | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_LOGISTICS_UNITS_BF43.md`](./WMS_LOGISTICS_UNITS_BF43.md), [`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md) | WMS | **Partial** — **`WmsOutboundLogisticsUnit`** + BF-29 multiset substitution + Operations UI; EPCIS backlog |
| **BF-44** | Outbound tenant webhooks | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md), [`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md) | Integrations | **Partial** — subscriptions + **`emitWmsOutboundWebhooks`** + milestones + **`retryFailedOutboundWebhookDeliveries`** cron ([`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md)); DLQ UI backlog |
| **BF-45** | Partner scoped REST reads | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md), [`openapi-partner-v1.yaml`](./openapi-partner-v1.yaml) | Integrations | **Partial** — **`WmsPartnerApiKey`** + inventory/outbound **`GET`** + rate-limit header stub; OAuth / enforced limits backlog |
| **BF-46** | Customer portal OIDC federation | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md), [`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md) | Platform + auth | **Partial** — discovery + PKCE + JWT verify + **`po_auth_user`** parity with BF-30; SAML backlog |
| **BF-47** | Posted billing disputes & credit stubs | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_BILLING_BF47.md`](./WMS_BILLING_BF47.md), [`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md), [`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md) | WMS + finance alignment | **Partial** — **POST_DISPUTED** + **`WmsBillingCreditMemoStub`** + webhook kinds; AR subledger backlog |
| **BF-48** | Inventory field ACL matrix (serial slice) | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_RBAC_BF48.md`](./WMS_RBAC_BF48.md), [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md) | Platform + WMS | **Partial** — **`wms-field-acl-matrix.json`** + **`org.wms.inventory.serial`** + gates + Stock UI; external PDP / ABAC backlog |
| **BF-49** | Unified operations timeline | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_OPERATIONS_TIMELINE_BF49.md`](./WMS_OPERATIONS_TIMELINE_BF49.md) | **CT + WMS** | **Partial** — **`GET /api/control-tower/timeline`** + home feeds; SIEM / retention backlog |
| **BF-50** | Topology graph export | [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md), [`WMS_TOPOLOGY_BF50.md`](./WMS_TOPOLOGY_BF50.md), [`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md) | WMS + simulation vendors | **Partial** — **`GET /api/wms?topologyGraph=1`** + POST export + Setup UI + **`ADJACENT_SLOT`** heuristic edges; orchestration / CAD meshes backlog |
| **BF-51** | Structured cycle counts | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md), [`WMS_CYCLE_COUNT_BF51.md`](./WMS_CYCLE_COUNT_BF51.md) | WMS | **Partial** — sessions + submit/approve + reason codes + **`cycleCountSessions`** payload; supervisor role split / recount workflow backlog |
| **BF-52** | Slotting recommendations | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md), [`WMS_SLOTTING_BF52.md`](./WMS_SLOTTING_BF52.md) | WMS | **Partial** — advisory **`GET /api/wms/slotting-recommendations`** + CSV + Setup preview; solver / auto-task backlog |

---

## Capsule cards (draft `BF-53` … `BF-70`)

Use [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) **§BF-xx** for objectives + exit sketches until a capsule ships and earns a dedicated **`WMS_*_BFxx.md`** note.

| ID | `GAP_MAP` signal (when funded) | Primary docs | Shared / CRM / CT? | Status |
|----|-------------------------------|--------------|---------------------|--------|
| **BF-53** | Labor / productivity | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-53 | WMS | **Draft** |
| **BF-54** | Dock / yard detention | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-54 | WMS + CT alerts | **Draft** |
| **BF-55** | Inter-site inventory | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-55 | WMS | **Draft** |
| **BF-56** | Pick execution (batch) | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-56 | WMS | **Draft** |
| **BF-57** | Logistics units / GS1 depth | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-57 | WMS | **Draft** |
| **BF-58** | Holds / freeze matrix | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-58 | WMS | **Draft** |
| **BF-59** | Inbound ASN pre-advise | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-59 | WMS | **Draft** |
| **BF-60** | Field mobile / offline | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-60 | WMS | **Draft** |
| **BF-61** | Replenishment / forecast hints | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-61 | WMS (+ CRM optional) | **Draft** |
| **BF-62** | VAS kit assembly | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-62 | WMS | **Draft** |
| **BF-63** | Catch-weight receiving | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-63 | WMS | **Draft** |
| **BF-64** | Cold-chain custody | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-64 | WMS + CT | **Draft** |
| **BF-65** | Damage / claims export | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-65 | WMS | **Draft** |
| **BF-66** | Voice pick protocol | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-66 | WMS | **Draft** |
| **BF-67** | Multi-parcel manifests | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-67 | WMS | **Draft** |
| **BF-68** | Customs filing export | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-68 | WMS | **Draft** |
| **BF-69** | Sustainability / CO₂ hints | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-69 | Product + WMS | **Draft** |
| **BF-70** | External PDP hooks | [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-70 | Platform + WMS | **Draft** |

---

## What “create those capsules” means here

| Artifact | Location |
|----------|-----------|
| IDs + themes | [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md) — **BF-51**/**BF-52** landed · **BF-53 … BF-70** draft rows |
| **Order + dependency narrative** | This file |
| Execution | **One capsule per milestone:** GitHub issue (label `module:wms`) or agent prompt with **`BF-xx`** in the title and goals copied from the **correct** row — **not** the BF-01 template unless the capsule **is** BF-01 |

We **did not** add duplicate per-capsule specs beside existing theme docs — avoid scatter; deepen **`docs/wms/*`** when a capsule ships (ADR / limits + **`GAP_MAP`** row).

---

_Last updated: 2026-05-03 — **BF-52** slotting recommendations advisory API + Setup preview ([`WMS_SLOTTING_BF52.md`](./WMS_SLOTTING_BF52.md)); **2026-05-02** — **BF-51** structured cycle counts ([`WMS_CYCLE_COUNT_BF51.md`](./WMS_CYCLE_COUNT_BF51.md)); **BF-53** … **BF-70** draft program (`BF51_BF70_MEGA_PHASES.md` + backlog catalog); **BF-50** warehouse topology graph export ([`WMS_TOPOLOGY_BF50.md`](./WMS_TOPOLOGY_BF50.md)); **BF-49** unified operations timeline API + CT/WMS feed ([`WMS_OPERATIONS_TIMELINE_BF49.md`](./WMS_OPERATIONS_TIMELINE_BF49.md)); **BF-48** inventory field ACL + **`org.wms.inventory.serial`** minimal ([`WMS_RBAC_BF48.md`](./WMS_RBAC_BF48.md)); **BF-47** posted billing disputes + credit memo stubs minimal ([`WMS_BILLING_BF47.md`](./WMS_BILLING_BF47.md)); **BF-46** customer portal OIDC minimal ([`WMS_CUSTOMER_PORTAL_OIDC_BF46.md`](./WMS_CUSTOMER_PORTAL_OIDC_BF46.md)); **BF-45** partner API minimal ([`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md)); **BF-44** outbound webhooks minimal ([`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md)); **BF-43** outbound logistics units minimal ([`WMS_LOGISTICS_UNITS_BF43.md`](./WMS_LOGISTICS_UNITS_BF43.md)); **BF-42** QA sampling + disposition templates minimal ([`WMS_QA_SAMPLING_BF42.md`](./WMS_QA_SAMPLING_BF42.md)); **BF-41** customer returns / RMA receiving minimal ([`WMS_RETURNS_BF41.md`](./WMS_RETURNS_BF41.md)); **BF-40** outbound ASN export minimal ([`WMS_OUTBOUND_ASN_BF40.md`](./WMS_OUTBOUND_ASN_BF40.md)); **BF-39** carrier label purchase minimal ([`WMS_CARRIER_LABEL_BF39.md`](./WMS_CARRIER_LABEL_BF39.md)); **BF-32** receiving accrual staging minimal ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)); **BF-31** GRN + ASN qty tolerance minimal ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)); **BF-30** customer portal SSO minimal ([`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md)); **BF-29** packing scan + demo carrier minimal ([`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md)); **BF-28** billing dispute hold ([`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md)); **BF-27** CT map approximate bin scatter ([`WMS_CT_MAP_BF27.md`](./WMS_CT_MAP_BF27.md)); **BF-26** CRM engineering BOM sync minimal ([`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md)); **BF-25** TMS webhook HMAC + idempotency ([`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md)); **BF-24** aisle masters minimal ([`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md)); **BF-23** reserve pick-face allocation minimal ([`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md)); **BF-22** CPQ contracted pricing minimal ([`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md)); **BF-21** receipt accounting minimal ([`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md)); **BF-20** KPI proxy rates; **`BF-02`–`BF-52`** Done table; **BF-11** + **BF-19** + **BF-27** CT map pins._
