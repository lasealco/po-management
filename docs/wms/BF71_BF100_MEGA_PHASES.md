# BF-71 … BF-100 — blueprint mega phases (post BF-70)

**Purpose:** Reserve and define the **next thirty blueprint-finish capsules** after **`BF-70`**, using the same capsule discipline as **`BF-51` … `BF-70`**: one capsule = one review gate, explicit **`GAP_MAP`** signals when funded and shipped, minimal viable schema/API/UI before declaring partial ✅.

**Authority:** Parent catalog rows live in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Prior shipped wave: [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md).

**Status:** **`BF-71`** — **minimal slice landed** ([`WMS_SERIAL_AGGREGATION_BF71.md`](./WMS_SERIAL_AGGREGATION_BF71.md)). **`BF-72`** — **minimal slice landed** ([`WMS_DANGEROUS_GOODS_BF72.md`](./WMS_DANGEROUS_GOODS_BF72.md)). **`BF-73`** — **minimal slice landed** ([`WMS_RECALL_CAMPAIGN_BF73.md`](./WMS_RECALL_CAMPAIGN_BF73.md)). **`BF-74`** — **minimal slice landed** ([`WMS_YARD_GEOFENCE_BF74.md`](./WMS_YARD_GEOFENCE_BF74.md)). **`BF-75`** — **minimal slice landed** ([`WMS_INBOUND_ASN_NORMALIZE_BF75.md`](./WMS_INBOUND_ASN_NORMALIZE_BF75.md)). **`BF-76`** — **minimal slice landed** ([`WMS_PICK_PATH_EXPORT_BF76.md`](./WMS_PICK_PATH_EXPORT_BF76.md)). **`BF-77`** — **minimal slice landed** ([`WMS_LABOR_VARIANCE_BF77.md`](./WMS_LABOR_VARIANCE_BF77.md)). **`BF-78`** … **`BF-100`** remain draft IDs until each capsule ships.

**Rules:**

1. **Do not** bundle **`BF-71` … `BF-100`** into one prompt unless product explicitly funds a program sprint — each ID is a separate thematic capsule.
2. Ship → update **[`GAP_MAP.md`](./GAP_MAP.md)** → refresh **[`BF_CAPSULE_ROADMAP.md`](./BF_CAPSULE_ROADMAP.md)** → add **`docs/wms/WMS_*_BFxx.md`** (or ADR) when a capsule lands.
3. Stay inside **`src/app/wms/**`, **`src/app/api/wms/**`, **`src/lib/wms/**`** unless the row explicitly names CRM/CT/platform/integrations — then touch shared surfaces minimally.

---

## Program rollup

| ID | Mega phase (short) | Primary `GAP_MAP` signal (when funded) | Typical depends on |
|----|-------------------|----------------------------------------|---------------------|
| **BF-71** | Aggregated serial closure at ship/pack | SKU / serial row (🔗 [`WMS_SERIAL_AGGREGATION_BF71.md`](./WMS_SERIAL_AGGREGATION_BF71.md)) | **BF-13** registry, **BF-57** LU closure |
| **BF-72** | Dangerous goods checklist + DG manifest JSON | Packing / trade compliance row ([`WMS_DANGEROUS_GOODS_BF72.md`](./WMS_DANGEROUS_GOODS_BF72.md)) | **BF-68** customs stub, **BF-29** scans |
| **BF-73** | Recall campaign workflow stub | Holds / compliance row (🔗 [`WMS_RECALL_CAMPAIGN_BF73.md`](./WMS_RECALL_CAMPAIGN_BF73.md)) | **BF-58** freeze matrix, **BF-02** lot metadata |
| **BF-74** | Yard geofence arrival webhook stub | Dock / yard row (🔗 [`WMS_YARD_GEOFENCE_BF74.md`](./WMS_YARD_GEOFENCE_BF74.md)) | **BF-05**, **BF-54** detention |
| **BF-75** | Inbound ASN EDI normalize stub | Inbound ASN row | **BF-59** pre-advise, **BF-31** tolerance |
| **BF-76** | Pick path sequence export | Pick execution row | **BF-56** batch waves, **BF-50** topology |
| **BF-77** | Labor variance exception queue | Labor row | **BF-53** standards + actuals |
| **BF-78** | STO landed-cost / FX notes stub | Inter-site inventory row | **BF-55** transfers |
| **BF-79** | VMI / consignment ownership metadata | Inventory accounting row | Stable **`InventoryBalance`** + tenant policy |
| **BF-80** | QA sampling enforcement on receipt close | Receiving / QA row | **BF-42** templates, **BF-31** close guards |
| **BF-81** | RFID commissioning scan bridge | Packing / identification row | **BF-29** multiset scans |
| **BF-82** | Movement hash-chain audit export | Permissions / audit row | Movement ledger stable |
| **BF-83** | Supplier receiving scorecard export | Receiving / SRM row | **BF-42**, **`Shipment`** disposition stats |
| **BF-84** | Promo uplift on forecast stub | Replenishment row | **BF-61** forecast stub |
| **BF-85** | Bulk RMA disposition rules | Returns row | **BF-41** RMA subtype |
| **BF-86** | Capacity utilization snapshot JSON | Slotting / topology row | **BF-50** graph, **BF-52** velocity |
| **BF-87** | Outbound commercial terms export | Commercial row | **BF-22** line snapshots |
| **BF-88** | ATP reservation policy tiers depth | ATP row | **BF-36** soft reservations |
| **BF-89** | Carton cube heuristic inputs on Product | Allocation row | **BF-15**, **BF-56** caps |
| **BF-90** | TMS appointment hint export (advisory) | Dock row | **BF-05**, **BF-17** |
| **BF-91** | Inventory aging bucket export (FIFO stub) | Inventory inquiry row | Ledger + **BF-02** batch attrs |
| **BF-92** | Denied-party screening hook | Trade compliance row | **BF-68**, CRM parties |
| **BF-93** | Tenant WMS feature-flag bundle JSON | Ops / platform row | **`Tenant`** policy JSON patterns |
| **BF-94** | Serialized kit genealogy on **`KIT_BUILD`** | VAS / serial row | **BF-62**, **BF-13** |
| **BF-95** | Scrap / liquidation valuation stub | QA / returns row | **BF-41** disposition, **BF-42** |
| **BF-96** | Dock SLA breach risk scorer (heuristic JSON) | Dock row | **BF-54**, appointments |
| **BF-97** | Scope-3 upstream CO₂e factor stub | Sustainability row | **BF-69**, **`Product`** / supplier attrs |
| **BF-98** | Partner API scoped mutation pilot | Integrations row | **BF-45** reads + keys |
| **BF-99** | WMS entity search snapshot export | Integrations row | **`GET /api/wms`** payloads stable |
| **BF-100** | Blueprint self-check gap report | Meta / QA row | **`GAP_MAP.md`**, action manifest |

**Suggested dependency-aware sequence (not mandatory):** serialization depth (**BF-71**, **BF-94**) after **BF-13** maturity; **BF-75** after **BF-59**; **BF-76**/**BF-89** after wave + topology reads stable; **BF-92** after **BF-68** parties snapshot; **BF-100** anytime as documentation tooling.

---

## BF-71 — Aggregated serial closure at ship/pack

**Objective:** Parent/child **serial aggregation** rules when nested LUs or kits ship — closes gaps between **BF-13** unit registry and **BF-57** hierarchy checks.

**Exit (landed):** **`WmsOutboundLuSerial`** + `link_outbound_lu_serial_bf71` / `unlink_outbound_lu_serial_bf71` / `validate_outbound_serial_aggregation_bf71` + **`GET /api/wms/outbound-serial-manifest-export`** (`bf71.v1`) + optional **`WMS_ENFORCE_BF71_SERIAL_AGGREGATION`** on ship — see [`WMS_SERIAL_AGGREGATION_BF71.md`](./WMS_SERIAL_AGGREGATION_BF71.md).

**Exit sketch (remaining backlog):** Deeper kit/genealogy hooks (**BF-94**), automated serialization on pick/pack.

**Out of scope:** Full **EPCIS** repository, OEM serialization hubs.

---

## BF-72 — Dangerous goods checklist + DG manifest JSON

**Objective:** Tenant DG profile per SKU/shipment + checklist gate before **`mark_outbound_shipped`**; JSON manifest sibling to **BF-68**.

**Exit (landed):** Product dangerous-goods columns (existing master data) + **`OutboundOrder.wmsDangerousGoodsChecklistJson`** (`wms.dg_checklist_state.bf72.v1`) + **`submit_outbound_dangerous_goods_checklist_bf72`** / **`clear_outbound_dangerous_goods_checklist_bf72`** / **`validate_outbound_dangerous_goods_bf72`** + **`GET /api/wms/dangerous-goods-manifest`** (`bf72.v1`) + optional **`WMS_ENFORCE_DG_CHECKLIST_BF72`** on **`mark_outbound_shipped`** — see [`WMS_DANGEROUS_GOODS_BF72.md`](./WMS_DANGEROUS_GOODS_BF72.md).

**Exit sketch (remaining backlog):** Tenant DG policy matrices, carrier placard automation.

**Out of scope:** IMDG certified labeling automation.

---

## BF-73 — Recall campaign workflow stub

**Objective:** Named **recall campaign** scopes (lot/product/warehouse) that enqueue **`apply_inventory_freeze`** / tasks — extends **BF-58**.

**Exit (landed):** **`WmsRecallCampaign`** + **`create_recall_campaign_bf73`** / **`materialize_recall_campaign_bf73`** / **`close_recall_campaign_bf73`** + **`GET /api/wms`** **`recallCampaigns`** + Stock workspace panel — see [`WMS_RECALL_CAMPAIGN_BF73.md`](./WMS_RECALL_CAMPAIGN_BF73.md).

**Out of scope:** FDA/regulatory filing portals.

---

## BF-74 — Yard geofence arrival webhook stub

**Objective:** Signed **`POST /api/wms/yard-geofence-webhook`** translating trailer arrival pings → **`record_dock_appointment_yard_milestone`**-equivalent updates (**BF-05**, **BF-54**).

**Exit (landed):** **`WMS_YARD_GEOFENCE_WEBHOOK_SECRET`** Bearer + optional HMAC (**`X-Yard-Geofence-Signature`**) + **`WmsYardGeofenceWebhookReceipt`** idempotency (**`externalEventId`**) + **`CtAuditLog`** **`yard_geofence_webhook_bf74`** + shared milestone writer with **`dock_detention_breach`** — see [`WMS_YARD_GEOFENCE_BF74.md`](./WMS_YARD_GEOFENCE_BF74.md).

**Out of scope:** Fleet telematics OEM integrations.

---

## BF-75 — Inbound ASN EDI normalize stub

**Objective:** Canonical **`bf75.v1`** JSON parsed from partner ASN envelopes → upserts into **`WmsInboundAsnAdvise`** (**BF-59**).

**Shipped (minimal):** **`POST /api/wms/inbound-asn-normalize`** (**`partnerId`** + **`rawEnvelope`**) → **`bf75.v1`** + optional persist; **`asnPartnerId`** on advise rows; Operations UI panel — [`WMS_INBOUND_ASN_NORMALIZE_BF75.md`](./WMS_INBOUND_ASN_NORMALIZE_BF75.md).

**Out of scope:** Full X12/EDIFACT translators in-process.

---

## BF-76 — Pick path sequence export

**Objective:** Deterministic **ordered bin visit list** for a wave (`PICK` tasks) as CSV/JSON for voice/cart hardware.

**Shipped (minimal):** **`GET /api/wms/pick-path-export?waveId=`** (**`bf76.v1`** JSON; **`format=csv`**) — [`WMS_PICK_PATH_EXPORT_BF76.md`](./WMS_PICK_PATH_EXPORT_BF76.md).

**Out of scope:** MILP route solver, AMR dispatch.

---

## BF-77 — Labor variance exception queue

**Objective:** Flag **`WmsTask`** rows where actual duration vs **`standardMinutes`** exceeds tenant thresholds; Operations queue JSON on **`GET /api/wms`**.

**Shipped (minimal):** **`Tenant.wmsLaborVariancePolicyJson`** + **`set_wms_labor_variance_policy`** + **`laborVarianceBf77`** on **`GET /api/wms`** — [`WMS_LABOR_VARIANCE_BF77.md`](./WMS_LABOR_VARIANCE_BF77.md).

**Out of scope:** Payroll gross pay export.

---

## BF-78 — STO landed-cost / FX notes stub

**Objective:** Optional **`landedCostNotesJson`** / FX pair on **`WmsStockTransfer`** for finance narrative alongside **BF-55** ledger.

**Exit sketch:** PATCH/POST field + CSV export column.

**Out of scope:** ERP cost absorption postings.

---

## BF-79 — VMI / consignment ownership metadata

**Objective:** **`InventoryBalance`** (or parallel row) flags **vendor-owned** vs **company-owned** stock for 3PL billing splits.

**Exit sketch:** Nullable FK + **`GET /api/wms`** balance column + filter.

**Out of scope:** Full consignment invoicing engine.

---

## BF-80 — QA sampling enforcement on receipt close

**Objective:** Block **`close_wms_receipt`** when **BF-42** template demands sampling and required QA rows incomplete.

**Exit sketch:** Evaluate helper + deterministic error code.

**Out of scope:** LIMS instrument feeds.

---

## BF-81 — RFID commissioning scan bridge

**Objective:** Accept TID/EPC writes in **`validate_outbound_pack_scan`** / offline batch (**BF-60**) as optional identifiers mapped to **`Product`** / LU.

**Exit sketch:** Encoding table JSON + scan normalization helper.

**Out of scope:** Printer encode stations SDK.

---

## BF-82 — Movement hash-chain audit export

**Objective:** Export contiguous **`InventoryMovement`** tail hashes (`sha256` chaining) for tamper-evidence narratives.

**Exit sketch:** **`GET /api/wms/movement-audit-chain`** (`tenantId`, `since`, cap).

**Out of scope:** Blockchain mainnet anchoring.

---

## BF-83 — Supplier receiving scorecard export

**Objective:** Aggregate OTIF/defect signals per **`CrmAccount`** / carrier from receiving rows → CSV for **SRM**.

**Exit sketch:** **`GET /api/wms/supplier-receiving-scorecard`** (window + `format=csv`).

**Out of scope:** Carrier tender optimization.

---

## BF-84 — Promo uplift on forecast stub

**Objective:** Optional uplift multiplier per SKU on **`WmsDemandForecastStub`** feeding **BF-61** gap hints.

**Exit sketch:** JSON column + **`forecastGapHints`** doc mention.

**Out of scope:** Retail promo calendar ERP sync.

---

## BF-85 — Bulk RMA disposition rules

**Objective:** Tenant rule list (reason → disposition template / hold) applied on **`CUSTOMER_RETURN`** intake (**BF-41**).

**Exit sketch:** `WmsRmaDispositionRule` table or JSON policy + POST **`apply_rma_disposition_rules`**.

**Out of scope:** Refund orchestration.

---

## BF-86 — Capacity utilization snapshot JSON

**Objective:** Bin × velocity heat snapshot from **`InventoryBalance`** + pick aggregates — complements **BF-52**.

**Exit sketch:** **`GET /api/wms/capacity-utilization-snapshot`** (`bf86.v1`, capped bins).

**Out of scope:** Heatmap GIS tiles.

---

## BF-87 — Outbound commercial terms export

**Objective:** Snapshot **`Incoterms`**, payment days, bill-to refs on outbound ship notice JSON beside **BF-22**.

**Exit sketch:** Extend **`GET /api/wms/outbound-asn-export`** or parallel **`commercial-terms-export`**.

**Out of scope:** Letter-of-credit workflows.

---

## BF-88 — ATP reservation policy tiers depth

**Objective:** Tiered TTL / priority rules on **`WmsInventorySoftReservation`** (**BF-36**) per channel/customer.

**Exit sketch:** Tenant JSON policy + enforcement in allocate/pick.

**Out of scope:** ERP ATP federation.

---

## BF-89 — Carton cube heuristic inputs on Product

**Objective:** Optional **`cartonUnits`**, **`unitCubeCm3`** on **`Product`** feeding **BF-15**/**BF-56** carton caps heuristics.

**Exit sketch:** Columns + Setup UI + wave evaluate logs.

**Out of scope:** 3D carton nesting solver.

---

## BF-90 — TMS appointment hint export

**Objective:** Advisory JSON suggesting dock window reshuffles from queue depth + **BF-54** timers — no auto-write.

**Exit sketch:** **`GET /api/wms/tms-appointment-hints`** (`bf90.v1`).

**Out of scope:** TMS solver API write-back.

---

## BF-91 — Inventory aging bucket export

**Objective:** FIFO-ish age buckets per balance from first-receipt timestamp heuristic → CSV.

**Exit sketch:** Derived view + **`GET /api/wms/inventory-aging-export`**.

**Out of scope:** Full cost-layer accounting.

---

## BF-92 — Denied-party screening hook

**Objective:** Optional HTTP PDP-style check (**BF-70** pattern) for ship parties vs screening provider — blocks **`mark_outbound_shipped`** when **deny**.

**Exit sketch:** Env URL + timeout + JSON allow/deny contract.

**Out of scope:** Sanctions list subscription management.

---

## BF-93 — Tenant WMS feature-flag bundle JSON

**Objective:** **`Tenant.wmsFeatureFlagsJson`** (or similar) surfaced on **`GET /api/wms`** for ops toggles without redeploy.

**Exit sketch:** PATCH **`set_wms_feature_flags`** + dashboard meta card.

**Out of scope:** Full LaunchDarkly delegation.

---

## BF-94 — Serialized kit genealogy on KIT_BUILD

**Objective:** When **`KIT_BUILD`** completes, optional output SN registration links tied to consumed lots (**BF-62** + **BF-13**).

**Exit sketch:** POST payload extension + trace expansion.

**Out of scope:** Pharmaceutical pedigree hubs.

---

## BF-95 — Scrap / liquidation valuation stub

**Objective:** Optional cents **`scrapValuePerUnit`** on dispositions / damage (**BF-41**/65) for finance preview only.

**Exit sketch:** Columns + claim export extension.

**Out of scope:** Auction integrations.

---

## BF-96 — Dock SLA breach risk scorer

**Objective:** Deterministic score JSON per active appointment from milestones + **BF-54** policy — early warning card.

**Exit sketch:** **`dockSlaRiskScores`** array on **`GET /api/wms`** when enabled.

**Out of scope:** ML models training pipeline.

---

## BF-97 — Scope-3 upstream CO₂e factor stub

**Objective:** Supplier/product upstream factor grams CO₂e per kg extends **BF-69** methodology string.

**Exit sketch:** Nullable supplier attrs + movement rollup hint field.

**Out of scope:** CDP assurance audits.

---

## BF-98 — Partner API scoped mutation pilot

**Objective:** Single audited **`POST`** (e.g. hold release or ASN advise upsert) under **BF-45** key scopes.

**Exit sketch:** **`POST /api/wms/partner/v1/mutations/*`** + OpenAPI fragment.

**Out of scope:** Full partner write catalog.

---

## BF-99 — WMS entity search snapshot export

**Objective:** JSON Lines export of shallow **`Shipment`/`OutboundOrder`/task indexes for external search appliances.

**Exit sketch:** **`GET /api/wms/search-snapshot`** (cursor + cap).

**Out of scope:** Elasticsearch cluster hosting.

---

## BF-100 — Blueprint self-check gap report

**Objective:** Doc-only or script emits **`GAP_MAP`** coverage vs shipped **`POST /api/wms`** actions — regression aid for PM/architecture.

**Exit sketch:** `scripts/wms-blueprint-self-check.mjs` (or doc checklist) run in CI optional.

**Out of scope:** Formal ISO certification tooling.

---

## Prompt stub (copy for any BF-71 … BF-100 issue)

> Execute capsule **BF-xx** from [`docs/wms/BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) and the matching row in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Stay inside WMS module boundaries unless the row explicitly includes CRM/CT/platform/integrations. Deliver: schema/migrations if needed, API actions, minimal UI, tests, **`GAP_MAP`** + capsule roadmap updates, commit message referencing **BF-xx**.

---

_Last updated: **2026-04-29** — initial draft program (**BF-71** … **BF-100**) seeded._
