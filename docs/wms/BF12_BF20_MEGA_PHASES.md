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
| **BF-15** | Allocation / wave solver v2 | Cartonization, multi-wave optimizer beyond **FEFO/FIFO** demos | BF-03 strategies |
| **BF-16** | Per-field WMS ACL | Fine-grained mutations vs **BF-06** coarse tiers | BF-06 tier map stable |
| **BF-17** | TMS / carrier stub | Carrier milestones → EDI/API hooks (not full TMS) | BF-05 dock transport |
| **BF-18** | VAS multi-line BOM | Consumption engine beyond single-row **`VALUE_ADD`** | BF-09 intake |
| **BF-19** | CT map depth | Rack floor or **CRM** geo layers on map (pick one primary per ship) | BF-11 warehouse pins |
| **BF-20** | KPI rates layer | OTIF **rates**, labor/slotting proxies beyond BF-07 narratives | BF-07 home KPIs |

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

**Minimal slice shipped (repo):** **`CrmQuoteLine.inventorySku`** (maps to tenant **`Product.sku`**); CRM **`POST/PATCH …/lines`** + quote detail UI; **`explode_crm_quote_to_outbound`** on **`POST /api/wms`** (`quoteExplosionConfirm` false = preview JSON, true = insert lines when outbound has **no lines** and quote-linked); **`create_outbound_order`** allows **zero lines** when **`sourceCrmQuoteId`** is set (quote shell); Operations outbound card preview table + confirm; **`CtAuditLog`** **`outbound_quote_lines_exploded`**. Respects **BF-06** **`operations`** tier + **`loadWmsViewReadScope`** product-division filter on SKU resolution.

**Out of scope:** Full CPQ configurator, tier pricing solver.

---

## BF-15 — Wave / allocation solver v2

**Objective:** Move beyond single-pass **`orderPickSlotsForWave`** heuristics toward **carton-aware** or **capacity-aware** batching (even if deterministic, not MILP).

**Exit sketch:** Lib module + tests + wave UI toggle or strategy enum; **`WMS_ALLOCATION_STRATEGIES.md`** updated; **`GAP_MAP`** allocation row tightened.

**Out of scope:** Real-time labor headcount optimization.

---

## BF-16 — Per-field WMS ACL matrix

**Objective:** Extend **`WMS_RBAC_AND_AUDIT.md`** with **field/action** rules beyond **`gateWmsPostMutation`** tiers (e.g., who may adjust lot expiry vs qty).

**Exit sketch:** Policy table or rule JSON + enforcement on selected mutations; admin UI or seed manifest; docs + API tests.

**Out of scope:** Full ABAC, cross-tenant federation.

---

## BF-17 — TMS / carrier integration stub

**Objective:** Externalize carrier/booking identifiers and webhook placeholders so dock milestones (BF-05) can sync to a future TMS without rewriting APIs.

**Exit sketch:** Schema hooks + `POST` stub route or queue table; **`WMS_DOCK_APPOINTMENTS.md`** integration section; secrets documented as `.example` only.

**Out of scope:** Production carrier certifications, rate shopping.

---

## BF-18 — VAS multi-line BOM consumption

**Objective:** **`WmsWorkOrder`** consumes **multiple** component lines with exploded BOM snapshot and variance vs estimate.

**Exit sketch:** Schema for BOM lines + completion postings; **`WMS_VAS_BF09.md`** / **`WMS_VAS_WORK_ORDERS.md`** updated; demo seed path.

**Out of scope:** MRP regeneration, engineering change workflow.

---

## BF-19 — Control Tower map depth

**Objective:** Pick **one** primary: **(a)** approximate rack/bin pins OR **(b)** CRM account lat/long pins — implement read-only map overlays building on BF-11 infrastructure.

**Exit sketch:** **`GET /api/control-tower/map-pins`** extension + toggles; limits documented (privacy, accuracy); **`WMS_CT_MAP_PHASE34_WE11.md`** updated.

**Out of scope:** Indoor positioning mm accuracy, live forklift telemetry.

---

## BF-20 — Executive KPI rates

**Objective:** Promote BF-07 narratives to **computed rates** (OTIF proxy, pick productivity proxy, slotting health index) with definitions versioned in docs.

**Exit sketch:** **`fetchWmsHomeKpis`** (or successor) emits rate fields + methodology comment; dashboard copy explains denominators; **`GAP_MAP`** dashboards row updated.

**Out of scope:** Data warehouse export, ML forecasting.

---

## Prompt stub (copy for any BF-12 … BF-20 issue)

> Execute capsule **BF-xx** from [`docs/wms/BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md) and the matching row in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Stay inside WMS module boundaries unless the row explicitly includes CRM/CT. Deliver: schema/migrations if needed, API actions, minimal UI, tests, **`GAP_MAP`** + capsule roadmap updates, commit message referencing **BF-xx**.

---

_Last updated: 2026-04-29 — **BF-14** minimal (`inventorySku`, `explode_crm_quote_to_outbound`, WMS preview UI); program draft for BF-12 … BF-20 mega phases._
