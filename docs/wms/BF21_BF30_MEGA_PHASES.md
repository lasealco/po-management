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
| **BF-21** | Receipt accounting & ASN policies | **Minimal landed** — closed receipt history + idempotent close + optional **`RECEIPT_COMPLETE`** ([`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md)); **BF-31** dock GRN + ASN qty %-tolerance evaluate + close guards ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)); **BF-32** receiving accrual staging snapshot + export ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)); carrier ASN hub auto-close backlog | BF-12 **`WmsReceipt`** session |
| **BF-22** | CPQ contracted pricing on outbound | **Minimal landed** — **`listUnitPrice`** / **`priceTierLabel`** on **`CrmQuoteLine`**, **`resolveQuoteLineCommercialPricing`**, explosion preview deltas + **`OutboundOrderLine.commercial*`** snapshots — [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md) | BF-10 / BF-14 commercial path |
| **BF-23** | Allocation MILP / cube / labor | **Minimal landed** — **`GREEDY_RESERVE_PICK_FACE`** (pick-face reserve tie-break on BF-15 greedy); optional **`WMS_DISABLE_BF23_STRATEGY`** — [`WMS_ALLOCATION_BF23.md`](./WMS_ALLOCATION_BF23.md) | BF-03 / BF-15 strategies stable |
| **BF-24** | First-class **Aisle** / geometry hooks | **Minimal landed** — **`WarehouseAisle`** + **`WarehouseBin.warehouseAisleId`** + mm columns + `create_warehouse_aisle` / `update_warehouse_aisle` — [`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md) | BF-04 **`parentZoneId`** stable |
| **BF-25** | Production TMS / carrier EDI | **Minimal landed** — optional **`TMS_WEBHOOK_HMAC_SECRET`** + **`X-TMS-Signature`**, **`WmsTmsWebhookReceipt`** + **`externalEventId`** ([`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md)); certify / JWT / DLQ backlog | BF-05 / BF-17 dock transport |
| **BF-26** | VAS MRP / engineering change | **Minimal landed** — CRM **`engineeringBom*`** on **`CrmQuoteLine`**, **`link_work_order_crm_quote_line`**, **`sync_work_order_bom_from_crm_quote_line`**, variance on **`GET /api/wms`** — [`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md) | BF-18 **`WmsWorkOrderBomLine`** |
| **BF-27** | CT map indoor / rack pins | **Minimal landed** — **`warehouseBinPins`** scatter near BF-11 sites (`buildWarehouseBinMapPins`, cap 200, CT toggle) — [`WMS_CT_MAP_BF27.md`](./WMS_CT_MAP_BF27.md) | BF-11 / BF-19 map stack |
| **BF-28** | Billing / invoice depth (Phase B+) | **Minimal landed** — disputed billing events held out of draft runs ([`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md)); accrual / approval gates / accounting export backlog | Phase B billing row |
| **BF-29** | Packing scanner & carrier label APIs | **Minimal landed** — pack/ship scan multiset + env gates + **`DEMO_PARCEL`** ZPL adapter ([`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md)); production carrier purchases backlog | BF-08 pack/ship + labels |
| **BF-30** | Customer portal SSO & identity | **Minimal landed** — **`customerPortalExternalSubject`**, **`POST /api/auth/customer-portal/sso`** (simulate + HMAC), VAS intake CRM lock + API guard ([`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md)); SAML/OIDC / JWKS backlog | BF-09 portal assumptions |

**Suggested dependency-aware sequence (not mandatory):** BF-21 → BF-22 → BF-23 (receiving truth → commercial price truth → solver); BF-24 parallel when migrations owned separately; BF-25 after BF-17 patterns proven (**minimal landed**); BF-26 after BF-18 usage (**minimal landed**); BF-27 after map product decision (**minimal landed**); BF-28 when finance owns invoice UX; BF-29 with vendor picks; BF-30 when CRM/platform owns IdP.

---

## BF-21 — Receipt accounting & ASN policies

**Objective:** Close the gap between **BF-12** dock receipts and finance-ready receiving: receipt history beyond **`CLOSED`** summary rows, ASN auto-close rules, and warehouse accounting hooks (accrual/grn stubs **optional** in v1).

**Minimal slice shipped (repo):** **`closedWmsReceiptHistory`** + refined **`openWmsReceipt`** selection on **`GET /api/wms`** inbound shipments; **`close_wms_receipt`** **idempotent** when already **`CLOSED`**; optional **`receiptCompleteOnClose`** advances **`wmsReceiveStatus` → `RECEIPT_COMPLETE`** when the state machine allows (`canAdvanceReceiveStatusToReceiptComplete`, audit **`source: close_wms_receipt`**); Operations inbound UI (history list + checkbox); [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md); Vitest **`wms-receipt-close-policy.test.ts`**.

**Exit sketch (remaining):** ASN auto-close from carrier feeds; centralized **`GRN`** numbering beyond dock-entered refs (**BF-31** minimal); promotion of **`WmsReceivingAccrualStaging`** into **`WmsBillingEvent`** / ERP posts (**BF-32** minimal landed staging-only); multi-event receipt reconciliation UX beyond history list.

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

**Minimal slice shipped (repo):** Optional **`TMS_WEBHOOK_HMAC_SECRET`** — **`POST /api/wms/tms-webhook`** verifies **`X-TMS-Signature: sha256=<hex>`** over raw UTF-8 body when secret set (Bearer **`TMS_WEBHOOK_SECRET`** unchanged). Optional JSON **`externalEventId`** → **`WmsTmsWebhookReceipt`** (`@@unique([tenantId, externalEventId])`); duplicate delivery same appointment → **`{ ok: true, duplicate: true }`** without mutating **`WmsDockAppointment`**; key reuse for another appointment → **409**. Audit payload adds **`hmacEnforced`**. Docs [`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md), [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md); Vitest **`tms-webhook-stub.test.ts`**.

**Exit sketch (remaining):** JWT/mTLS, DLQ/retry dashboards, vendor certification packs.

**Out of scope:** Rate shopping, freight audit payables.

---

## BF-26 — VAS MRP / engineering change

**Objective:** Sync **`WmsWorkOrderBomLine`** from CRM/engineering BOM revisions with explicit **ECO** versioning and consumption freeze rules.

**Minimal slice shipped (repo):** **`CrmQuoteLine.engineeringBomRevision`**, **`engineeringBomLines`** (JSON SKU rows), **`engineeringBomMaterialsCents`**; **`PATCH …/crm/quotes/[id]/lines/[lineId]`** persists validated JSON; **`WmsWorkOrder.crmQuoteLineId`** + **`engineeringBomSynced*`**; **`link_work_order_crm_quote_line`** / **`sync_work_order_bom_from_crm_quote_line`** (**operations** tier; same no-consumption replace guard as BF-18); optional **`crmQuoteLineId`** on **`create_work_order`** (account parity when WO CRM account set); **`GET /api/wms`** **`materialsEstimateVsEngineeringVarianceCents`**; Operations UI link + sync + variance line; Vitest **`engineering-bom-sync.test.ts`** — [`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md).

**Exit sketch (remaining):** Webhook or scheduled pull from PLM; partial BOM supersede when some lines already consumed; automated cost rollup from item master.

**Out of scope:** Full nightly MRP, full PLM replacement.

---

## BF-27 — Control Tower indoor map layer

**Objective:** Optional **rack/bin** or **approximate indoor** pins on **`/control-tower/map`** (path **(a)** deferred from **BF-19**), with performance and privacy limits documented.

**Minimal slice shipped (repo):** **`buildWarehouseBinMapPins`** + **`warehouseBinScatterCoordinate`** — active **`WarehouseBin`** rows with **`warehouseId`** matching a BF-11 site pin scatter near that jittered coordinate (scaled deterministic jitter from **`product-trace-geo`** helpers); **`GET /api/control-tower/map-pins`** adds **`warehouseBinPins`** + **`warehouseBinPinsTruncated`** (cap **200**); **`control-tower-map-client.tsx`** teal ▲ layer toggle + popups; Vitest **`map-layers.test.ts`** — [`WMS_CT_MAP_BF27.md`](./WMS_CT_MAP_BF27.md), [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md).

**Exit sketch (remaining):** Surveyed CAD footprints; **`WarehouseAisle`** mm-backed indoor tiles; RTLS tracks.

**Out of scope:** CAD tile server, RTLS forklift tracks.

---

## BF-28 — Billing / invoice depth (Phase B+)

**Objective:** Extend **`WmsBillingEvent`** / invoice runs with **disputes**, **accrual** placeholders, **approval** gates, or export to accounting — pick **one** primary per ship.

**Minimal slice shipped (repo):** **`WmsBillingEvent.billingDisputed`** + **`billingDisputeNote`**; **`invoiceEligibleBillingEventsWhere`**; **`createInvoiceRunFromUnbilledEvents`** skips disputed rows; **`GET /api/wms/billing`** eligible vs disputed unbilled counts; **`POST`** **`set_billing_event_dispute`** (uninvoiced + read scope); billing workspace dispute/clear UI; home KPI + cockpit uninvoiced exclude disputed — [`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md); Vitest **`billing-invoice-eligibility.test.ts`**.

**Exit sketch (remaining):** Accrual stubs; approval gates before post; richer accounting export; disputed-after-post policies.

**Out of scope:** Full AR subledger, tax engine.

---

## BF-29 — Packing scanner & carrier label APIs

**Objective:** **BF-08** depth: device-assisted **scan confirm** on pack/ship and/or **carrier label purchase** APIs (vendor-specific adapters).

**Minimal slice shipped (repo):** Multiset **pack scan** verification (`pack-scan-verify.ts`); optional **`WMS_REQUIRE_PACK_SCAN`** / **`WMS_REQUIRE_SHIP_SCAN`**; **`validate_outbound_pack_scan`**; **`packScanTokens`** / **`shipScanTokens`** on **`mark_outbound_packed`** / **`mark_outbound_shipped`**; **`GET /api/wms`** `packShipScanPolicy` + **`packScanPlan`**; **`request_demo_carrier_label`** (**`DEMO_PARCEL`**) + **`carrier-label-demo-adapter`**; Operations UI queues + demo carrier ZPL — [`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md); Vitest **`pack-scan-verify.test.ts`**, **`carrier-label-demo-adapter.test.ts`**.

**Exit sketch (remaining):** Real carrier purchases; PDF 4×6; scanner device integrations.

**Out of scope:** Full WMS hardware certification lab.

---

## BF-30 — Customer portal SSO & identity

**Objective:** **BF-09** depth: **SSO** (SAML/OIDC) or tenant-branded login for **`CUSTOMER_PORTAL`** flows; scoped claims → **`customerCrmAccountId`** mapping.

**Minimal slice shipped (repo):** Prisma **`User.customerPortalExternalSubject`** + partial unique index per tenant; **`signCustomerPortalSsoPayload`** / **`verifyCustomerPortalSsoPayload`** / **`resolveUserForCustomerPortalSso`**; **`POST /api/auth/customer-portal/sso`** (`CUSTOMER_PORTAL_SSO_SIMULATE_SECRET` + header, or **`CUSTOMER_PORTAL_SSO_HMAC_SECRET`** + **`sub`/`email`/`ts`/`sig`**); **`request_customer_vas_work_order`** CRM parity when actor is customer-scoped; **`/wms/vas-intake`** locked CRM picker when **`customerCrmAccountId`** set; seed **`customer@demo-company.com`** grants + demo **`externalSubject`**; Vitest **`customer-portal-sso.test.ts`**; [`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md).

**Exit sketch (remaining):** Real IdP (SAML/OIDC/JWKS); auth provider config per tenant; session hardening; portal routes grant-tested beyond VAS intake.

**Out of scope:** Full B2B marketplace multi-vendor.

---

## Prompt stub (copy for any BF-21 … BF-30 issue)

> Execute capsule **BF-xx** from [`docs/wms/BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) and the matching row in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Stay inside WMS module boundaries unless the row explicitly includes CRM/CT/platform. Deliver: schema/migrations if needed, API actions, minimal UI, tests, **`GAP_MAP`** + capsule roadmap updates, commit message referencing **BF-xx**.

---

_Last updated: 2026-05-08 — **BF-32** receiving accrual staging minimal ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md), [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md)); **BF-31** GRN + ASN qty tolerance ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)); **BF-30** customer portal SSO bridge + VAS CRM lock minimal ([`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md)); **BF-29** packing scan verify + demo carrier label minimal ([`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md)); **BF-28** billing dispute hold minimal ([`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md)); **BF-27** CT map approximate bin scatter minimal ([`WMS_CT_MAP_BF27.md`](./WMS_CT_MAP_BF27.md)); **BF-26** CRM engineering BOM sync minimal ([`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md)); **BF-25** TMS webhook HMAC + idempotency minimal ([`WMS_TMS_WEBHOOK_BF25.md`](./WMS_TMS_WEBHOOK_BF25.md)); **BF-24** minimal **`WarehouseAisle`** slice ([`WMS_ZONE_TOPOLOGY_BF24.md`](./WMS_ZONE_TOPOLOGY_BF24.md)); program capsules **BF-21**–**BF-30** minimal slices shipped in-repo where noted; **`BF-02`–`BF-32`** Done table in [`BF_CAPSULE_ROADMAP.md`](./BF_CAPSULE_ROADMAP.md)._
