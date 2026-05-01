# BF-12 … BF-20 — blueprint mega phases (post BF-11)

**Purpose:** Define the **next nine blueprint-finish capsules** after **`BF-02` … `BF-11`** using the same **mega-phase discipline**: one capsule = one review gate, explicit **`GAP_MAP`** signals, minimal viable schema/API/UI before declaring partial ✅.

**Authority:** Parent catalog rows live in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). This file expands **objectives, dependencies, and exit sketches** so prompts stay scoped.

**Rules (same as BF-01 … BF-11):**

1. **Do not** bundle BF-12 … BF-20 into one prompt unless product explicitly funds a program sprint — each ID is a separate thematic capsule.
2. Ship → update **[`GAP_MAP.md`](./GAP_MAP.md)** → refresh **[`BF_CAPSULE_ROADMAP.md`](./BF_CAPSULE_ROADMAP.md)** status column.
3. Stay inside **`src/app/wms/**`, **`src/app/api/wms/**`, **`src/lib/wms/**`** unless the capsule row names CRM/CT/integrations — then touch shared surfaces minimally.

---

## Program rollup

| ID | Mega phase (short) | Primary deferred signal ([`GAP_MAP.md`](./GAP_MAP.md)) | Typical depends on |
|----|-------------------|--------------------------------------------------------|---------------------|
| **BF-12** | Receiving Option B — receipt header | Separate **`WmsReceipt`** / multi-event dock receipts vs Option A only | BF-01 variance semantics stable |
| **BF-13** | Serial / unit genealogy | Per-unit serial beyond **`lotCode`** + **`WmsLotBatch`** | BF-02 lot metadata |
| **BF-14** | CPQ → outbound automation | Quote lines → **`OutboundOrderLine`** without manual re-entry | BF-10 lineage (**minimal landed**) |
| **BF-15** | Allocation / wave solver v2 | Greedy min-bin heuristic + **optional wave unit cap** ( **`GREEDY_MIN_BIN_TOUCHES`**, **`pickWaveCartonUnits`** ) (**minimal landed**); **BF-23** adds **`GREEDY_RESERVE_PICK_FACE`** — [`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md); MILP / cube carton / labor backlog | BF-03 strategies |
| **BF-16** | Per-field WMS ACL | Fine-grained mutations vs **BF-06** coarse tiers | BF-06 tier map stable |
| **BF-17** | TMS / carrier stub | Carrier milestones → EDI/API hooks (not full TMS) | BF-05 dock transport |
| **BF-18** | VAS multi-line BOM | Consumption engine beyond single-row **`VALUE_ADD`** | BF-09 intake |
| **BF-19** | CT map depth | **CRM HQ pins minimal landed** (`CrmAccount` lat/lng + map layer); **rack floor** on CT map still deferred | BF-11 warehouse pins |
| **BF-20** | KPI rates layer | **Minimal landed** — `rates` + `rateMethodology` on **`fetchWmsHomeKpis`**; delivered OTIF % / engineered labor / ABC slotting backlog | BF-07 home KPIs |

**Suggested dependency-aware sequence (not mandatory):** BF-12 → BF-13 → BF-14 (receiving truth → serials → commercial automation); BF-15 parallel to BF-14 when owners differ; BF-16 early if security gates block expansion; BF-17 after BF-05; BF-18 after BF-09; BF-19 after BF-11; BF-20 last or parallel once reporting consumers exist.

---

## BF-12 — Receiving Option B (receipt header)

**Objective:** Introduce a tenant-scoped **`WmsReceipt`** (name TBD in ADR) representing a dock receipt **session** that can aggregate multiple **`ShipmentItem`** lines and statuses without breaking Option A flows.

**Exit sketch:** Migration + minimal **`POST /api/wms`** actions (`create_wms_receipt`, link shipment/items); inbound UI affordance; **`GAP_MAP`** inbound row documents Option A vs B coexistence; tests for idempotency and variance alignment with BF-01.

**Out of scope (initial gate):** Full warehouse accounting reconciliation, ASN auto-close policies, mobile scanner UX.

---

## BF-13 — Serial / unit genealogy

**Objective:** Persist **serial numbers** (or equivalent unit IDs) attached to movements/balances with trace reads for recall/regulatory demos.

**Exit sketch:** Minimal table(s) + `set_inventory_serial` / query hooks; Stock or trace UI slice; docs in **`WMS_LOT_SERIAL_DECISION.md`** extended; no requirement to solve full GS1 aggregation in v1.

**Minimal slice shipped (repo):** `WmsInventorySerial` / `WmsInventorySerialMovement`; actions **`register_inventory_serial`**, **`set_inventory_serial_balance`**, **`attach_inventory_serial_to_movement`**; **`GET /api/wms?traceProductId=&traceSerialNo=`** ( **`serialTrace`** payload ); Stock UI panel (`/wms/stock`). Naming differs from sketch (`register_inventory_serial` vs generic `set_inventory_serial`) — same intent.

**Out of scope:** Serialization at manufacturing source, carrier ASN serialization.

---

## BF-14 — CPQ quote lines → outbound lines

**Objective:** Given **`OutboundOrder.sourceCrmQuoteId`** (BF-10), expand **`CrmQuoteLine`** into **`OutboundOrderLine`** rows with SKU/qty mapping rules and human confirmation.

**Exit sketch:** Server action + validation + audit; WMS or CRM UI preview/diff; **`WMS_COMMERCIAL_HANDOFF.md`** updated; feature flagged or grant-gated.

**Minimal slice shipped (repo):** **`CrmQuoteLine.inventorySku`** (maps to tenant **`Product.sku`**); CRM **`POST/PATCH …/lines`** + quote detail UI; **`explode_crm_quote_to_outbound`** on **`POST /api/wms`** (`quoteExplosionConfirm` false = preview JSON, true = insert lines when outbound has **no lines** and quote-linked); **`create_outbound_order`** allows **zero lines** when **`sourceCrmQuoteId`** is set (quote shell); Operations outbound card preview table + confirm; **`CtAuditLog`** **`outbound_quote_lines_exploded`**. Respects **BF-06** **`operations`** tier + **`loadWmsViewReadScope`** product-division filter on SKU resolution. **BF-22:** optional **`listUnitPrice`** / **`priceTierLabel`**, resolver preview deltas + **`OutboundOrderLine.commercial*`** snapshots ([`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md)).

**Out of scope:** Full CPQ configurator; automated tier / ladder solver; external price-book sync.

---

## BF-15 — Wave / allocation solver v2

**Objective:** Move beyond single-pass **`orderPickSlotsForWave`** heuristics toward **carton-aware** or **capacity-aware** batching (even if deterministic, not MILP).

**Exit sketch:** Lib module + tests + wave UI toggle or strategy enum; **`WMS_ALLOCATION_STRATEGIES.md`** updated; **`GAP_MAP`** allocation row tightened.

**Minimal slice shipped (repo):** Enum **`GREEDY_MIN_BIN_TOUCHES`** (fungible automated waves): **`orderPickSlotsMinBinTouches`** prefers bins that cover an outbound line’s **remaining** qty in one task — among full-cover bins, **smallest sufficient** first — before splitting across bins; **`Warehouse.pickWaveCartonUnits`** clamps automated wave pick tasks (`create_pick_wave`); **`set_warehouse_pick_wave_carton_units`** **`POST /api/wms`** + Setup UI; wave notes append **`cartonCap=`** when set — **[`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md)**. **BF-23** extends allocation depth with **`GREEDY_RESERVE_PICK_FACE`** (same min-touch logic; **`WarehouseBin.isPickFace`** tie-break defers pick-face bins when qty ties) — **[`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md)**.

**Out of scope:** Real-time labor headcount optimization; MILP; carton cube geometry.

---

## BF-16 — Per-field WMS ACL matrix

**Objective:** Extend **`WMS_RBAC_AND_AUDIT.md`** with **field/action** rules beyond **`gateWmsPostMutation`** tiers (e.g., who may adjust lot expiry vs qty).

**Minimal slice shipped (repo):** Global **`org.wms.inventory.lot`** (view / edit) in **`GLOBAL_PERMISSION_CATALOG`**; manifest **`WMS_POST_ACTIONS_LOT_METADATA_SCOPED`** (`set_wms_lot_batch` today) in **`src/lib/wms/wms-inventory-field-acl.ts`**; **`gateWmsPostMutation`** splits inventory-tier POST actions so **lot-only** editors cannot post holds, cycle counts, serial registry actions, etc.; Stock workspace (**`/wms/stock`**) disables qty-path controls unless **`org.wms.inventory` → edit** (or legacy **`org.wms` → edit**). Buyer/Superuser demo seeds include **`inventory.lot`** alongside **`inventory`**. Vitest: **`wms-inventory-field-acl.test.ts`**.

**Exit sketch (remaining):** Broader matrix rows / admin assignment UX / **`CtAuditLog`** on additional transitions.

**Out of scope:** Full ABAC, cross-tenant federation.

---

## BF-17 — TMS / carrier integration stub

**Objective:** Externalize carrier/booking identifiers and webhook placeholders so dock milestones (BF-05) can sync to a future TMS without rewriting APIs.

**Minimal slice shipped (repo):** `WmsDockAppointment` columns **`tmsLoadId`**, **`tmsCarrierBookingRef`**, **`tmsLastWebhookAt`**; **`set_dock_appointment_tms_refs`** (`POST /api/wms`, operations tier); **`POST /api/wms/tms-webhook`** Bearer stub (`TMS_WEBHOOK_SECRET`) updating refs / optional **`yardMilestone`** for `SCHEDULED` rows + **`CtAuditLog`** `tms_webhook_stub`; Operations UI columns + save controls; placeholder env file **`docs/wms/tms-webhook.env.example`**. **BF-25** extends the webhook with optional **`TMS_WEBHOOK_HMAC_SECRET`** / **`X-TMS-Signature`** and **`externalEventId`** idempotency — [`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md).

**Exit sketch (remaining):** JWT/mTLS, outbound retry queue, richer multi-tenant routing beyond **`tenantSlug`**.

**Out of scope:** Production carrier certifications (beyond BF-25 checklist doc), rate shopping.

---

## BF-18 — VAS multi-line BOM consumption

**Objective:** **`WmsWorkOrder`** consumes **multiple** component lines with exploded BOM snapshot and variance vs estimate.

**Minimal slice shipped (repo):** **`WmsWorkOrderBomLine`** (`plannedQty` / `consumedQty`); **`replace_work_order_bom_lines`** (full replace while WO **`OPEN`/`IN_PROGRESS`** and **no** line has **`consumedQty` > 0**); **`consume_work_order_bom_line`** ( **`ADJUSTMENT`** movement, **`referenceType = WO_BOM_LINE`**, **`referenceId` = BOM line id); Operations UI BOM table + replace + consume; optional **`npm run db:seed:wms-vas-bom-demo`** after **`db:seed:wms-demo`**.

**Exit sketch (remaining):** BF-26 lands CRM-authored SKU BOM push (**[`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md)**); **partial supersede** when a retained BOM line already has **`consumedQty` > 0**; nightly regen backlog.

**Out of scope:** Full MRP regeneration nightly, full PLM replacement (beyond BF-26 PATCH/sync stub).

---

## BF-19 — Control Tower map depth

**Objective:** Pick **one** primary: **(a)** approximate rack/bin pins OR **(b)** CRM account lat/long pins — implement read-only map overlays building on BF-11 infrastructure.

**Minimal slice shipped (repo):** **(b)** — **`CrmAccount.mapLatitude` / `mapLongitude`** (nullable decimals; PATCH on **`/api/crm/accounts/[id]`** sets/clears pair with range checks); **`buildCrmAccountMapPins`** + **`crmAccountPins`** / **`crmAccountsMissingGeo`** on **`GET /api/control-tower/map-pins`** with CRM owner scope + portal **`customerCrmAccountId`** restriction; **`/control-tower/map`** toggle (**◆** layer); CRM account workspace overview saves coords + link to map; demo seed sets sample coords on Demo Logistics Customer.

**Exit sketch (remaining):** Rack/bin overlays on CT map (**BF-27** lands approximate **`warehouseBinPins`** — not surveyed CAD); automatic geocode; richer CRM entity geo (contacts, SO pins).

**Out of scope:** Indoor positioning mm accuracy, live forklift telemetry.

---

## BF-20 — Executive KPI rates

**Objective:** Promote BF-07 narratives to **computed rates** (OTIF proxy, pick productivity proxy, slotting health index) with definitions versioned in docs.

**Minimal slice shipped (repo):** **`fetchWmsHomeKpis`** returns **`rates`** (`otifPastDueSharePercent`, `outboundScheduledCohortCount`, `pickTasksPerActiveOutbound`, `replenishmentShareOfPickFaceWorkloadPercent`) plus **`rateMethodology`** bullet strings; extra **`OutboundOrder`** count for scheduled cohort; **`/wms`** executive cards + narratives panel document denominators ([`WMS_EXECUTIVE_KPIS_BF07.md`](./WMS_EXECUTIVE_KPIS_BF07.md)); **`GAP_MAP`** dashboards row updated.

**Exit sketch (remaining):** Delivered OTIF % by lane/customer; labor hours vs standards; velocity-based slotting scores.

**Out of scope:** Data warehouse export, ML forecasting.

---

## Prompt stub (copy for any BF-12 … BF-20 issue)

> Execute capsule **BF-xx** from [`docs/wms/BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) and the matching row in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Stay inside WMS module boundaries unless the row explicitly includes CRM/CT. Deliver: schema/migrations if needed, API actions, minimal UI, tests, **`GAP_MAP`** + capsule roadmap updates, commit message referencing **BF-xx**.

---

_Last updated: 2026-04-29 — **BF-26** CRM engineering BOM sync extends BF-18 VAS BOM (**[`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md)**); **BF-17** webhook extended by **BF-25** (optional HMAC + **`externalEventId`** idempotency, [`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md)); **2026-05-03** — **BF-23** reserve pick-face allocation minimal ([`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md)); **BF-22** CPQ list/tier + outbound **`commercial*`** snapshots ([`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md)); **2026-05-02** — **BF-20** minimal executive KPI proxy rates (`buildExecutiveRates`, `rates` + `rateMethodology` on **`fetchWmsHomeKpis`**, `/wms` copy); **`BF-21`–`BF-30`** program [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md); **BF-19** minimal CRM HQ pins on CT map (`CrmAccount` map coords, `crmAccountPins`, scoped API + UI); **BF-18** minimal VAS multi-line BOM (`WmsWorkOrderBomLine`, `replace_work_order_bom_lines`, `consume_work_order_bom_line`, WMS UI, seed **`db:seed:wms-vas-bom-demo`**); **BF-15** minimal wave allocation v2 (`GREEDY_MIN_BIN_TOUCHES`, `pickWaveCartonUnits`, Setup UI); **BF-14** minimal (`inventorySku`, `explode_crm_quote_to_outbound`, WMS preview UI); program draft for BF-12 … BF-20 mega phases._

---

## Next program wave

Definitions for **BF-21 … BF-30**: minimal slices shipped — [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) (**BF-30** [`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md)).
