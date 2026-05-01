# BF-21 … BF-30 — blueprint mega phases (post BF-20)

**Purpose:** Define the **next ten blueprint-finish capsules** after **`BF-12` … `BF-20`** using the same mega-phase discipline: one capsule = one review gate, explicit **`GAP_MAP`** signals, minimal viable schema/API/UI before declaring partial ✅.

**Authority:** Parent catalog rows live in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Prior shipped wave: [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md).

**Rules (same as earlier BF waves):**

1. **Do not** bundle BF-21 … BF-30 into one prompt unless product explicitly funds a program sprint — each ID is a separate thematic capsule.
2. Ship → update **[`GAP_MAP.md`](./GAP_MAP.md)** → refresh **[`BF_CAPSULE_ROADMAP.md`](./BF_CAPSULE_ROADMAP.md)** when a capsule lands.
3. Stay inside **`src/app/wms/**`, **`src/app/api/wms/**`, **`src/lib/wms/**`** unless the capsule row names CRM/CT/integrations — then touch shared surfaces minimally.

---

## Program rollup

| ID | Mega phase (short) | Primary deferred signal ([`GAP_MAP.md`](./GAP_MAP.md)) | Typical depends on |
|----|-------------------|--------------------------------------------------------|---------------------|
| **BF-21** | Receipt accounting & ASN policies | **Minimal landed** — closed receipt history + idempotent close + optional **`RECEIPT_COMPLETE`** ([`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md)); carrier ASN auto-close / GRN backlog | BF-12 **`WmsReceipt`** session |
| **BF-22** | CPQ contracted pricing on outbound | **Minimal landed** — **`listUnitPrice`** / **`priceTierLabel`** on **`CrmQuoteLine`**, **`resolveQuoteLineCommercialPricing`**, explosion preview deltas + **`OutboundOrderLine.commercial*`** snapshots — [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md) | BF-10 / BF-14 commercial path |
| **BF-23** | Allocation MILP / cube / labor | **Minimal landed** — **`GREEDY_RESERVE_PICK_FACE`** (pick-face reserve tie-break on BF-15 greedy); optional **`WMS_DISABLE_BF23_STRATEGY`** — [`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md) | BF-03 / BF-15 strategies stable |
| **BF-24** | First-class **Aisle** / geometry hooks | **Minimal landed** — **`WarehouseAisle`** + **`WarehouseBin.warehouseAisleId`** + mm columns + `create_warehouse_aisle` / `update_warehouse_aisle` — [`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md) | BF-04 **`parentZoneId`** stable |
| **BF-25** | Production TMS / carrier EDI | Signed webhooks, certify, idempotent carrier IDs (**BF-17** stub → prod) | BF-05 / BF-17 dock transport |
| **BF-26** | VAS MRP / engineering change | Automated BOM sync + variance vs **`estimatedMaterialsCents`** | BF-18 **`WmsWorkOrderBomLine`** |
| **BF-27** | CT map indoor / rack pins | Rack-bin overlays on **`/control-tower/map`** vs WMS Setup only | BF-11 / BF-19 map stack |
| **BF-28** | Billing / invoice depth (Phase B+) | Accrual, disputes, run controls beyond event materialization | Phase B billing row |
| **BF-29** | Packing scanner & carrier label APIs | Hardware confirm path + carrier APIs (**BF-08** depth) | BF-08 pack/ship + labels |
| **BF-30** | Customer portal SSO & identity | AuthZ for **`/wms/vas-intake`** + quote/order visibility | BF-09 portal assumptions |

**Suggested dependency-aware sequence (not mandatory):** BF-21 → BF-22 → BF-23 (receiving truth → commercial price truth → solver); BF-24 parallel when migrations owned separately; BF-25 after BF-17 patterns proven; BF-26 after BF-18 usage; BF-27 after map product decision; BF-28 when finance owns invoice UX; BF-29 with vendor picks; BF-30 when CRM/platform owns IdP.

---

## BF-21 — Receipt accounting & ASN policies

**Objective:** Close the gap between **BF-12** dock receipts and finance-ready receiving: receipt history beyond **`CLOSED`** summary rows, ASN auto-close rules, and warehouse accounting hooks (accrual/grn stubs **optional** in v1).

**Minimal slice shipped (repo):** **`closedWmsReceiptHistory`** + refined **`openWmsReceipt`** selection on **`GET /api/wms`** inbound shipments; **`close_wms_receipt`** **idempotent** when already **`CLOSED`**; optional **`receiptCompleteOnClose`** advances **`wmsReceiveStatus` → `RECEIPT_COMPLETE`** when the state machine allows (`canAdvanceReceiveStatusToReceiptComplete`, audit **`source: close_wms_receipt`**); Operations inbound UI (history list + checkbox); [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md); Vitest **`wms-receipt-close-policy.test.ts`**.

**Exit sketch (remaining):** ASN tolerance/auto-close from carrier feeds; **`GRN`** references; accrual hooks; multi-event receipt reconciliation UX beyond history list.

**Out of scope:** Full ERP GL posting, mobile offline receiving.

---

## BF-22 — CPQ contracted pricing on outbound

**Objective:** Apply **contract / tier / price-list** logic when exploding quotes or editing **`OutboundOrderLine`**, not only **`Product.sku`** mapping (**BF-14**).

**Minimal slice shipped (repo):** **`CrmQuoteLine.listUnitPrice`** + **`priceTierLabel`**; CRM **`POST/PATCH …/lines`** + quote detail UI; **`resolveQuoteLineCommercialPricing`**; **`explode_crm_quote_to_outbound`** preview rows carry contracted/list/delta/tier; confirm writes **`commercialUnitPrice`**, **`commercialListUnitPrice`**, **`commercialPriceTierLabel`**, **`commercialExtendedAmount`** on **`OutboundOrderLine`**; **`GET /api/wms`** exposes commercial snapshots; Operations UI preview + line chips; **`CtAuditLog`** **`commercialSnapshots: true`**; [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md); Vitest **`cpq-contract-pricing.test.ts`**.

**Exit sketch (remaining):** External price books; volume ladders / tier matrices; automated CPQ solver.

**Out of scope:** Full Salesforce CPQ parity, subscription billing.

---

## BF-23 — Allocation MILP / cube / labor-aware solver

**Objective:** Move beyond **BF-15** deterministic heuristics toward **carton cube**, **capacity**, or **small MILP** formulations where product funds complexity.

**Minimal slice shipped (repo):** New enum **`GREEDY_RESERVE_PICK_FACE`** — BF-15 **`orderPickSlotsMinBinTouches`** semantics plus **`WarehouseBin.isPickFace`** tie-break via **`orderPickSlotsMinBinTouchesReservePickFace`**; **`create_pick_wave`** loads **`isPickFace`** on balance slots; Setup UI option; optional kill-switch **`WMS_DISABLE_BF23_STRATEGY=1`** on **`set_warehouse_pick_allocation_strategy`** + **`create_pick_wave`**; [`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md); Vitest in **`allocation-strategy.test.ts`**.

**Exit sketch (remaining):** MILP / cube dimensions / labor capacity routing.

**Out of scope:** Real-time labor heatmaps, slotting optimizer unified with replenishment.

---

## BF-24 — First-class Aisle / geometry hooks

**Objective:** Introduce **`Aisle`** (or equivalent) and optional **metric geometry** fields per [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md), without forcing CT map indoor tiles (**BF-27**).

**Minimal slice shipped (repo):** Prisma **`WarehouseAisle`** (per-warehouse **`code` / `name`**, optional **`zoneId`** hint, optional **`lengthMm`–`originZMm`**, **`isActive`**); nullable **`WarehouseBin.warehouseAisleId`** with **`resolveBinAisleFieldsForWrite`** validation vs master **`code`**; **`create_warehouse_aisle`** / **`update_warehouse_aisle`** + audit stubs; **`create_bin`** / **`update_bin_profile`** accept **`warehouseAisleId`**; **`GET /api/wms`** returns **`aisles`** + bin aisle snapshots; WMS Setup UI — [`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md); Vitest **`warehouse-aisle.test.ts`**.

**Exit sketch (remaining):** Aisle adjacency graph; bin validator hooks beyond label parity; richer geometry editors.

**Out of scope:** Digital twin simulation, AGV routing.

---

## BF-25 — Production TMS / carrier EDI

**Objective:** Replace **BF-17** stub with **production-grade** carrier integrations: signed payloads, retry, multi-tenant routing, certification checklist.

**Exit sketch:** Integration guide; env/secrets pattern; **`WMS_DOCK_APPOINTMENTS.md`** ops runbook.

**Out of scope:** Rate shopping, freight audit payables.

---

## BF-26 — VAS MRP / engineering change

**Objective:** Sync **`WmsWorkOrderBomLine`** from CRM/engineering BOM revisions with explicit **ECO** versioning and consumption freeze rules.

**Exit sketch:** CRM webhook or pull job; WMS replace rules when **`consumedQty = 0`**; variance dashboard stub.

**Out of scope:** Full MRP regeneration nightly, PLM replacement.

---

## BF-27 — Control Tower indoor map layer

**Objective:** Optional **rack/bin** or **approximate indoor** pins on **`/control-tower/map`** (path **(a)** deferred from **BF-19**), with performance and privacy limits documented.

**Exit sketch:** Pin builder from **`WarehouseBin`** addressing + jitter; toggles; **`WMS_CT_MAP_PHASE34_WE11.md`** updated.

**Out of scope:** CAD tile server, RTLS forklift tracks.

---

## BF-28 — Billing / invoice depth (Phase B+)

**Objective:** Extend **`WmsBillingEvent`** / invoice runs with **disputes**, **accrual** placeholders, **approval** gates, or export to accounting — pick **one** primary per ship.

**Exit sketch:** API + minimal UI; **`GAP_MAP`** billing row tightened.

**Out of scope:** Full AR subledger, tax engine.

---

## BF-29 — Packing scanner & carrier label APIs

**Objective:** **BF-08** depth: device-assisted **scan confirm** on pack/ship and/or **carrier label purchase** APIs (vendor-specific adapters).

**Exit sketch:** Adapter interface + one demo carrier or scanner mock; Operations UX guardrails.

**Out of scope:** Full WMS hardware certification lab.

---

## BF-30 — Customer portal SSO & identity

**Objective:** **BF-09** depth: **SSO** (SAML/OIDC) or tenant-branded login for **`CUSTOMER_PORTAL`** flows; scoped claims → **`customerCrmAccountId`** mapping.

**Exit sketch:** Auth provider config; session hardening doc; portal routes grant-tested.

**Out of scope:** Full B2B marketplace multi-vendor.

---

## Prompt stub (copy for any BF-21 … BF-30 issue)

> Execute capsule **BF-xx** from [`docs/wms/BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) and the matching row in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Stay inside WMS module boundaries unless the row explicitly includes CRM/CT/platform. Deliver: schema/migrations if needed, API actions, minimal UI, tests, **`GAP_MAP`** + capsule roadmap updates, commit message referencing **BF-xx**.

---

_Last updated: 2026-05-04 — **BF-24** minimal **`WarehouseAisle`** slice ([`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md)); program capsules **BF-21**–**BF-24** have minimal slices shipped in-repo; **`BF-02`–`BF-24`** Done table in [`BF_CAPSULE_ROADMAP.md`](./BF_CAPSULE_ROADMAP.md); **BF-25**–**BF-30** draft._
