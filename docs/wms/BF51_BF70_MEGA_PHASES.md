# BF-51 … BF-70 — blueprint mega phases (post BF-50)

**Purpose:** Define the **next twenty blueprint-finish capsules** after **`BF-50`** using the same discipline as **`BF-31` … `BF-50`**: one capsule = one review gate, explicit **`GAP_MAP`** signals when shipped, minimal viable schema/API/UI before declaring partial ✅.

**Authority:** Parent catalog rows live in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Prior shipped waves: [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md).

**Status:** **`BF-51`** … **`BF-65`** — **minimal slices shipped** ([`WMS_CYCLE_COUNT_BF51.md`](./WMS_CYCLE_COUNT_BF51.md), [`WMS_SLOTTING_BF52.md`](./WMS_SLOTTING_BF52.md), [`WMS_LABOR_BF53.md`](./WMS_LABOR_BF53.md), [`WMS_DOCK_DETENTION_BF54.md`](./WMS_DOCK_DETENTION_BF54.md), [`WMS_STOCK_TRANSFER_BF55.md`](./WMS_STOCK_TRANSFER_BF55.md), [`WMS_BATCH_PICK_BF56.md`](./WMS_BATCH_PICK_BF56.md), [`WMS_LU_HIERARCHY_BF57.md`](./WMS_LU_HIERARCHY_BF57.md), [`WMS_INVENTORY_FREEZE_BF58.md`](./WMS_INVENTORY_FREEZE_BF58.md), [`WMS_INBOUND_ASN_ADVISE_BF59.md`](./WMS_INBOUND_ASN_ADVISE_BF59.md), [`WMS_OFFLINE_SCAN_BF60.md`](./WMS_OFFLINE_SCAN_BF60.md), [`WMS_FORECAST_REPLENISHMENT_BF61.md`](./WMS_FORECAST_REPLENISHMENT_BF61.md), [`WMS_KIT_BUILD_BF62.md`](./WMS_KIT_BUILD_BF62.md), [`WMS_CATCH_WEIGHT_BF63.md`](./WMS_CATCH_WEIGHT_BF63.md), [`WMS_COLD_CHAIN_BF64.md`](./WMS_COLD_CHAIN_BF64.md), [`WMS_DAMAGE_CLAIM_BF65.md`](./WMS_DAMAGE_CLAIM_BF65.md)). **`BF-66` … `BF-70`** remain **draft program IDs** — merge/split/reorder before execution.

**Rules:**

1. **Do not** bundle BF-54 … BF-70 into one prompt unless product explicitly funds a program sprint — each ID is a separate thematic capsule.
2. Ship → update **[`GAP_MAP.md`](./GAP_MAP.md)** → refresh **[`BF_CAPSULE_ROADMAP.md`](./BF_CAPSULE_ROADMAP.md)** → add **`docs/wms/WMS_*_BFxx.md`** (or ADR) when a capsule lands.
3. Stay inside **`src/app/wms/**`, **`src/app/api/wms/**`, **`src/lib/wms/**`** unless the row explicitly names CRM/CT/platform/integrations — then touch shared surfaces minimally.

---

## Program rollup

| ID | Mega phase (short) | Primary `GAP_MAP` signal (when funded) | Typical depends on |
|----|-------------------|----------------------------------------|---------------------|
| **BF-51** | Cycle count programs & variance posting | Physical inventory / cycle count row | Stable **`InventoryBalance`** + audit (**BF-13**) — **`WmsCycleCountSession`** landed ([`WMS_CYCLE_COUNT_BF51.md`](./WMS_CYCLE_COUNT_BF51.md)) |
| **BF-52** | Slotting ABC / velocity recommendations | Slotting / bin assignment row | Executive KPIs (**BF-07**/20), movement history — **`GET /api/wms/slotting-recommendations`** landed ([`WMS_SLOTTING_BF52.md`](./WMS_SLOTTING_BF52.md)) |
| **BF-53** | Labor standards & task timing capture | Labor / productivity row | **`WmsTask`** + **`WmsLaborTaskStandard`** landed ([`WMS_LABOR_BF53.md`](./WMS_LABOR_BF53.md)) |
| **BF-54** | Yard detention & trailer clock alerts | Dock / yard row | **BF-05**, **BF-38** — **`Tenant.wmsDockDetentionPolicyJson`** + alerts landed ([`WMS_DOCK_DETENTION_BF54.md`](./WMS_DOCK_DETENTION_BF54.md)) |
| **BF-55** | Stock transfer orders & in-transit ledger | Inter-site inventory row | **`WmsStockTransfer`** + **`STO_SHIP`** / **`STO_RECEIVE`** landed ([`WMS_STOCK_TRANSFER_BF55.md`](./WMS_STOCK_TRANSFER_BF55.md)) |
| **BF-56** | Batch / cluster pick waves | Pick execution row | Wave model (**BF-15**), pick tasks — **`WmsWave.pickMode`**, **`WmsTask.batchGroupKey`** landed ([`WMS_BATCH_PICK_BF56.md`](./WMS_BATCH_PICK_BF56.md)) |
| **BF-57** | Nested LU aggregation & SSCC validation depth | Logistics units row | **BF-43** — `validateOutboundLuHierarchy`, **`validate_outbound_lu_hierarchy`**, **`WMS_ENFORCE_SSCC`** ship gate landed ([`WMS_LU_HIERARCHY_BF57.md`](./WMS_LU_HIERARCHY_BF57.md)) |
| **BF-58** | Inventory freeze matrix expansion | Holds / compliance row | Holds/quarantine patterns (**BF-41**/QA) — **`apply_inventory_freeze`**, delegated release grants landed ([`WMS_INVENTORY_FREEZE_BF58.md`](./WMS_INVENTORY_FREEZE_BF58.md)) |
| **BF-59** | Inbound ASN **pre-advise** ingestion stub | Inbound ASN row | **BF-31** tolerance — **`POST/GET /api/wms/inbound-asn-advise`**, **`WmsInboundAsnAdvise`** landed ([`WMS_INBOUND_ASN_ADVISE_BF59.md`](./WMS_INBOUND_ASN_ADVISE_BF59.md)) |
| **BF-60** | Mobile offline scan queue replay | Field UX row | **`POST /api/wms/scan-events/batch`**, **`WmsScanEventBatch`** landed ([`WMS_OFFLINE_SCAN_BF60.md`](./WMS_OFFLINE_SCAN_BF60.md)) |
| **BF-61** | Forecast-driven replenishment hints | Replenishment row | **BF-35** rules — **`WmsDemandForecastStub`** landed ([`WMS_FORECAST_REPLENISHMENT_BF61.md`](./WMS_FORECAST_REPLENISHMENT_BF61.md)) |
| **BF-62** | Kit assembly / build outbound postings | VAS / kit row | **BF-18** BOM, inventory mutations — **`KIT_BUILD`** tasks landed ([`WMS_KIT_BUILD_BF62.md`](./WMS_KIT_BUILD_BF62.md)) |
| **BF-63** | Catch-weight receiving | Receiving / UOM row | **BF-01**, **BF-31** — [`WMS_CATCH_WEIGHT_BF63.md`](./WMS_CATCH_WEIGHT_BF63.md) |
| **BF-64** | Cold-chain custody segments on movements | Compliance row | Movement ledger — [`WMS_COLD_CHAIN_BF64.md`](./WMS_COLD_CHAIN_BF64.md) |
| **BF-65** | Damage workflow & carrier claim export stub | Claims row | Receiving (**BF-41**/dispositions), Operations UI — [`WMS_DAMAGE_CLAIM_BF65.md`](./WMS_DAMAGE_CLAIM_BF65.md) |
| **BF-66** | Voice-picking task protocol (vendor-neutral JSON) | Pick execution row | Pick tasks, **BF-56** batch picks |
| **BF-67** | Multi-parcel outbound manifests | Packing / carrier row | **BF-39** labels, **BF-43** cartons |
| **BF-68** | Customs filing export JSON handoff | Trade compliance row | Outbound ship data, **BF-40** ASN lineage |
| **BF-69** | Carbon intensity hints on movements | Sustainability reporting row | Movement distances/modes (stub attrs) |
| **BF-70** | External PDP authorization hooks | Permissions row | **BF-06** tiers, **BF-48** field ACL evaluator hooks |

**Suggested dependency-aware sequence (not mandatory):** inventory accuracy (**BF-51**) before slotting (**BF-52**); dock depth (**BF-54**) after yard TMS maturity; transfers (**BF-55**) after ledger + optional **BF-36**; batch pick (**BF-56**) after wave task model; **BF-59** after **BF-31**; **BF-70** after **BF-48** manifest coverage.

---

## BF-51 — Cycle count programs & variance posting ✅ **Minimal landed**

**Objective:** Scheduled **cycle counts** (ABC / zone-based) with blind counts, variance approval, and **`InventoryMovement`** postings — without full wall-to-wall physical inventory ERP integration.

**Shipped:** [`WMS_CYCLE_COUNT_BF51.md`](./WMS_CYCLE_COUNT_BF51.md) — **`WmsCycleCountSession`** / **`WmsCycleCountLine`**; **`create_cycle_count_session`**, **`add_cycle_count_line`**, **`set_cycle_count_line_count`**, **`submit_cycle_count`**, **`approve_cycle_count_variance`**; **`GET /api/wms`** **`cycleCountSessions`**; Operations **Cycle count program (BF-51)** panel. Legacy **`create_cycle_count_task`** / **`complete_cycle_count_task`** unchanged (immediate adjustment).

**Out of scope:** RFID drones, perpetual inventory automation across ERPs, dedicated supervisor RBAC tier, recount reopen workflow.

---

## BF-52 — Slotting ABC / velocity recommendations ✅ **Minimal landed**

**Objective:** Export **recommended bin moves** from velocity/ABC class + pick-face rules — advisory first, optional task creation later.

**Shipped:** [`WMS_SLOTTING_BF52.md`](./WMS_SLOTTING_BF52.md) — **`GET /api/wms/slotting-recommendations`** (`warehouseId`, `days`, JSON or **`format=csv`**); `slotting-recommendations.ts` ABC from **`PICK`** aggregates + **`InventoryBalance`** / **`WarehouseBin.isPickFace`** heuristics; **Setup** preview + exports.

**Out of scope:** Automated robot slotting, solver-unified replenishment (**BF-35** merge only if product insists), auto-created relocation tasks.

---

## BF-53 — Labor standards & task timing capture ✅ **Minimal landed**

**Objective:** **Standard times** per task type + optional actual timestamps on **`WmsTask`** (or parallel **`WmsLaborSegment`**) for engineered labor KPIs (**BF-07** depth).

**Shipped:** [`WMS_LABOR_BF53.md`](./WMS_LABOR_BF53.md) — **`WmsLaborTaskStandard`**; **`WmsTask.startedAt`** / **`standardMinutes`**; **`set_wms_labor_task_standard`**, **`start_wms_task`**; task creates snapshot standards; **`fetchWmsHomeKpis.laborTiming`** + **`WMS_HOME_KPI_METHODOLOGY`**; Setup + Operations + home card.

**Out of scope:** Full LMS/WFM integration, payroll gross pay.

---

## BF-54 — Yard detention & trailer clock alerts ✅ **Minimal landed**

**Objective:** **Detention timers** from **`WmsDockAppointment`** milestones (check-in → unload → release) with CT/WMS alert surfacing.

**Shipped:** [`WMS_DOCK_DETENTION_BF54.md`](./WMS_DOCK_DETENTION_BF54.md) — `Tenant.wmsDockDetentionPolicyJson`; `set_wms_dock_detention_policy`; `collectDockDetentionAlerts`; payload `dockDetentionAlerts` + row `detentionAlert`; home `dockDetentionOpenAlerts`; retrospective `dock_detention_breach` on **`AT_DOCK`** / **`DEPARTED`** when segment exceeded policy (**BF-49** `ct_audit`).

**Out of scope:** Carrier billing dispute automation.

---

## BF-55 — Stock transfer orders & in-transit ledger ✅ **Minimal landed**

**Objective:** **Transfer order** document shipping qty between warehouses with **in-transit** state until receipt posts — mirrors many ERP STO flows.

**Shipped:** [`WMS_STOCK_TRANSFER_BF55.md`](./WMS_STOCK_TRANSFER_BF55.md) — `WmsStockTransfer` / `WmsStockTransferLine`; `create_wms_stock_transfer`, `release_wms_stock_transfer`, `cancel_wms_stock_transfer`, `set_wms_stock_transfer_line`, `ship_wms_stock_transfer`, `receive_wms_stock_transfer`; `STO_SHIP` / `STO_RECEIVE` on `InventoryMovement`; `stockTransfers` on **`GET /api/wms`**; **`stockTransfersInTransit`** on home KPIs; Operations STO panel.

**Out of scope:** Multi-leg ocean transfers, landed cost allocation, partial receive workflows beyond single receive, dedicated in-transit balance bucket rows.

---

## BF-56 — Batch / cluster pick waves ✅ **Minimal landed**

**Objective:** **Cluster pick** waves (cart/batch) assigning multiple orders to one picker path — beyond single-order waves.

**Shipped:** [`WMS_BATCH_PICK_BF56.md`](./WMS_BATCH_PICK_BF56.md) — `WmsWavePickMode`, `WmsWave.pickMode`, `WmsTask.batchGroupKey`; `create_pick_wave` + **`pickWavePickMode`** / **`pickMode`** **`BATCH`** | **`SINGLE_ORDER`**; bin visit order helper; **`GET /api/wms`** wave **`pickMode`** + task group key; Operations wave UI.

**Out of scope:** AMR cluster bots, dynamic re-batch during pick; solver strategies use **`SINGLE_ORDER`** only.

---

## BF-57 — Nested LU aggregation & SSCC validation depth ✅ **Minimal landed**

**Objective:** Stricter **GS1** hierarchy checks (**SSCC** checksum, parent/child LU closure) on **BF-43** logistics units at pack/ship.

**Shipped:** [`WMS_LU_HIERARCHY_BF57.md`](./WMS_LU_HIERARCHY_BF57.md) — `validateOutboundLuHierarchy`; **`validate_outbound_lu_hierarchy`**; **`mark_outbound_shipped`** guard when **`WMS_ENFORCE_SSCC=1`**; Operations validate control.

**Out of scope:** Full EPCIS repository.

---

## BF-58 — Inventory freeze matrix expansion ✅ **Minimal landed**

**Objective:** Expand **hold/freeze** reasons beyond ad hoc flags — matrix by **`reasonCode`**, scope (lot/bin/warehouse via bulk keys), and who may release (**BF-48** alignment).

**Shipped:** [`WMS_INVENTORY_FREEZE_BF58.md`](./WMS_INVENTORY_FREEZE_BF58.md) — `InventoryBalance` metadata; **`apply_inventory_freeze`** / **`release_inventory_freeze`**; delegated **`org.wms.inventory.hold.release_*`** grants; Stock badges + BF-58 control; partner inventory balances JSON.

**Out of scope:** Regulatory recall broadcast to FDA portals.

---

## BF-59 — Inbound ASN pre-advise ingestion stub ✅ **Minimal landed**

**Objective:** Accept **structured ASN pre-notifications** (JSON first; EDI later) to prime receiving expectations — complements **BF-31** tolerance at receipt.

**Shipped:** [`WMS_INBOUND_ASN_ADVISE_BF59.md`](./WMS_INBOUND_ASN_ADVISE_BF59.md) — **`WmsInboundAsnAdvise`**; **`POST` / `GET /api/wms/inbound-asn-advise`**; idempotent **`externalAsnId`**; Operations JSON panel + **`GET /api/wms`** **`inboundAsnAdvises`**.

**Out of scope:** Full 856 EDI certify, VAN connectivity.

---

## BF-60 — Mobile offline scan queue replay ✅ **Minimal landed**

**Objective:** Client **offline queue** of scans with server **replay + conflict** responses — minimal contract for rugged scanners.

**Shipped:** [`WMS_OFFLINE_SCAN_BF60.md`](./WMS_OFFLINE_SCAN_BF60.md) — **`WmsScanEventBatch`**; **`POST /api/wms/scan-events/batch`** with **`clientBatchId`** + monotonic **`seq`** + per-event **`deviceClock`**; cached **`lastResponseJson`** for idempotent replay; **`409`** **`SCAN_BATCH_CONFLICT`** payload; **`GET /api/wms`** **`scanEventBatches`** + Operations JSON panel.

**Out of scope:** Full PWA sync engine, CRDT inventory.

---

## BF-61 — Forecast-driven replenishment hints ✅ **Minimal landed**

**Objective:** Attach **demand forecast** snapshots (stub) to **`ReplenishmentRule`** / **`create_replenishment_tasks`** ordering on top of **BF-35**.

**Shipped:** [`WMS_FORECAST_REPLENISHMENT_BF61.md`](./WMS_FORECAST_REPLENISHMENT_BF61.md) — **`WmsDemandForecastStub`**; **`upsert_wms_demand_forecast_stub`**; **`GET /api/wms`** **`forecastGapHints`** + **`demandForecastStubs`**; batch sort + **`replenishmentPriority`** snapshot includes boost.

**Out of scope:** Statistical forecasting engine, ML models, live CRM demand ingest.

---

## BF-62 — Kit assembly / build-to-order postings

**Objective:** **Kit BOM explosion** into assembly **consumption + output** inventory movements (reverse direction of pick) for finished kits.

**Exit sketch (minimal slice):** **`create_kit_build_task`** consuming **`WmsWorkOrderBomLine`**-like kit rows; output SKU qty to bin.

**Shipped:** [`WMS_KIT_BUILD_BF62.md`](./WMS_KIT_BUILD_BF62.md) — **`WmsTaskType.KIT_BUILD`**; **`create_kit_build_task`** / **`complete_kit_build_task`**; structured task **`note`**; component **`ADJUSTMENT`** + output posting; Operations **Step 3** UI + open-task handling.

**Out of scope:** Full discrete MES routing.

---

## BF-63 — Catch-weight receiving

**Objective:** **Variable net weight** SKUs at receiving with legal UOM conversion and tolerance vs invoice weight.

**Exit sketch (minimal slice):** **`ShipmentItem.catchWeightKg`** (nullable); variance evaluate on close; label print hint field.

**Shipped:** [`WMS_CATCH_WEIGHT_BF63.md`](./WMS_CATCH_WEIGHT_BF63.md) — **`Product.isCatchWeight`**, **`Product.catchWeightLabelHint`**, **`Shipment.catchWeightTolerancePct`**; receive line + **`set_wms_receipt_line`** persist **`catchWeightKg`**; **`evaluate_wms_receipt_asn_tolerance`** returns **`catchWeight`** block; **`close_wms_receipt`** **`requireWithinCatchWeightForAdvance`** / **`blockCloseIfOutsideCatchWeight`**; **`set_product_catch_weight_bf63`**; Vitest **`catch-weight-receipt.test.ts`**.

**Out of scope:** Legal-for-trade scale certification integration.

---

## BF-64 — Cold-chain custody segments

**Objective:** **Temperature segment** metadata on **`InventoryMovement`** or shipment legs (min/max probe, breach flag) for pharma/food chains.

**Exit sketch (minimal slice):** **`custodySegmentJson`** on movement or **`Shipment`**; breach **`CtAuditLog`** / timeline hook **BF-49**.

**Shipped:** [`WMS_COLD_CHAIN_BF64.md`](./WMS_COLD_CHAIN_BF64.md) — **`InventoryMovement.custodySegmentJson`**, **`Shipment.custodySegmentJson`**; **`set_shipment_inbound_fields`** + **`set_inventory_movement_custody_segment_bf64`**; breach **`cold_chain_custody_breach_bf64`**; timeline movement **`detail.custodySegmentJson`**; Vitest **`custody-segment-bf64.test.ts`**.

**Out of scope:** IoT probe hardware SDKs.

---

## BF-65 — Damage workflow & carrier claim export stub

**Objective:** Structured **damage reports** at receiving/packing with photo URLs + **carrier claim** JSON export.

**Exit sketch (minimal slice):** **`WmsDamageReport`** + POST; export **`GET /api/wms/damage-reports/[id]/claim-export`**.

**Shipped:** [`WMS_DAMAGE_CLAIM_BF65.md`](./WMS_DAMAGE_CLAIM_BF65.md) — **`WmsDamageReport`**; **`create_wms_damage_report_bf65`**; **`GET /api/wms/damage-reports/[id]/claim-export`** (`bf65.v1`); **`CtAuditLog`** **`wms_damage_report_created_bf65`**; **`GET /api/wms`** **`wmsDamageReports`**; Vitest **`damage-report-bf65.test.ts`**.

**Out of scope:** Carrier API filing automation.

---

## BF-66 — Voice-picking JSON protocol stub

**Objective:** Vendor-neutral **voice task JSON** schema (`pickSeq`, `confirmSku`, `qtySpoken`) for integrators — no proprietary runtime.

**Exit sketch (minimal slice):** **`GET /api/wms/voice-pick/session`** returns task list JSON; **`POST`** confirmations map to pick confirmations.

**Out of scope:** Speech recognition, headset pairing.

---

## BF-67 — Multi-parcel shipment manifests

**Objective:** One **outbound ship unit** with **many tracking numbers** (parcel bag) — manifest PDF/JSON for carriers.

**Exit sketch (minimal slice):** **`OutboundOrder.manifestParcelIds`** JSON array + **`GET /api/wms/outbound-manifest-export`**.

**Out of scope:** LTL freight bills of lading solver.

---

## BF-68 — Customs filing export JSON handoff

**Objective:** Minimal **AES/customs filing** payload builder from outbound ship lines + parties — handoff to broker tooling.

**Exit sketch (minimal slice):** **`GET /api/wms/customs-filing-export`** for **`OutboundOrder`**; schema version **`bf68.v1`**.

**Out of scope:** Government message signing, customs broker APIs.

---

## BF-69 — Carbon intensity hints on movements

**Objective:** Optional **CO₂e estimate** fields on movements from mode/distance stubs — aligns with assistant sustainability narratives.

**Exit sketch (minimal slice):** **`movement.co2eEstimateGrams`** nullable + methodology string on **`GET /api/wms`** executive payload extension.

**Out of scope:** Third-party GLEC-certified audits.

---

## BF-70 — External PDP authorization hooks

**Objective:** Optional **external policy decision point** (HTTP) before sensitive **`POST /api/wms`** actions — extends **BF-48** evaluator with **`evaluateExternalWmsPolicy`** stub.

**Exit sketch (minimal slice):** Env **`WMS_EXTERNAL_PDP_URL`** + timeout; deny/allow JSON contract; Vitest mock server.

**Out of scope:** Full Open Policy Agent deployment in tenant VPC.

---

## Prompt stub (copy for any BF-51 … BF-70 issue)

> Execute capsule **BF-xx** from [`docs/wms/BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) and the matching row in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Stay inside WMS module boundaries unless the row explicitly includes CRM/CT/platform/integrations. Deliver: schema/migrations if needed, API actions, minimal UI, tests, **`GAP_MAP`** + capsule roadmap updates, commit message referencing **BF-xx**.

---

_Last updated: 2026-04-29 — **BF-61** forecast replenishment stub ([`WMS_FORECAST_REPLENISHMENT_BF61.md`](./WMS_FORECAST_REPLENISHMENT_BF61.md)); **BF-60** offline scan batch (`WmsScanEventBatch`, [`WMS_OFFLINE_SCAN_BF60.md`](./WMS_OFFLINE_SCAN_BF60.md)); **BF-59** inbound ASN pre-advise (`WmsInboundAsnAdvise`, [`WMS_INBOUND_ASN_ADVISE_BF59.md`](./WMS_INBOUND_ASN_ADVISE_BF59.md)); **BF-58** inventory freeze matrix ([`WMS_INVENTORY_FREEZE_BF58.md`](./WMS_INVENTORY_FREEZE_BF58.md)); **BF-57** LU hierarchy + SSCC (`validate_outbound_lu_hierarchy`, [`WMS_LU_HIERARCHY_BF57.md`](./WMS_LU_HIERARCHY_BF57.md)); **BF-56** batch pick waves ([`WMS_BATCH_PICK_BF56.md`](./WMS_BATCH_PICK_BF56.md)); **BF-55** stock transfer orders ([`WMS_STOCK_TRANSFER_BF55.md`](./WMS_STOCK_TRANSFER_BF55.md)); **2026-05-05** — **BF-54** dock detention ([`WMS_DOCK_DETENTION_BF54.md`](./WMS_DOCK_DETENTION_BF54.md)); **BF-53** labor ([`WMS_LABOR_BF53.md`](./WMS_LABOR_BF53.md)); **BF-52** slotting ([`WMS_SLOTTING_BF52.md`](./WMS_SLOTTING_BF52.md)); **BF-51** cycle counts ([`WMS_CYCLE_COUNT_BF51.md`](./WMS_CYCLE_COUNT_BF51.md)); **BF-61 … BF-70** draft stubs._
