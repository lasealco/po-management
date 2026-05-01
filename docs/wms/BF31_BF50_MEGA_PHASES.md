# BF-31 … BF-50 — blueprint mega phases (post BF-30)

**Purpose:** Define the **next twenty blueprint-finish capsules** after **`BF-21` … `BF-30`** using the same discipline: one capsule = one review gate, explicit **`GAP_MAP`** signals when shipped, minimal viable schema/API/UI before declaring partial ✅.

**Authority:** Parent catalog rows live in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Prior shipped waves: [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md).

**Status:** **BF-31** minimal slice shipped ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)); **BF-32** minimal slice shipped ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)); **BF-33** minimal slice shipped ([`WMS_ALLOCATION_BF33.md`](./WMS_ALLOCATION_BF33.md)); **BF-34** minimal slice shipped ([`WMS_ALLOCATION_BF34.md`](./WMS_ALLOCATION_BF34.md)); **BF-35** minimal slice shipped ([`WMS_REPLENISHMENT_BF35.md`](./WMS_REPLENISHMENT_BF35.md)); **BF-36** minimal slice shipped ([`WMS_ATP_BF36.md`](./WMS_ATP_BF36.md)); **BF-37** minimal slice shipped ([`WMS_CROSS_DOCK_BF37.md`](./WMS_CROSS_DOCK_BF37.md)); **BF-38** minimal slice shipped ([`WMS_DOCK_BF38.md`](./WMS_DOCK_BF38.md)); **BF-39** minimal slice shipped ([`WMS_CARRIER_LABEL_BF39.md`](./WMS_CARRIER_LABEL_BF39.md)); **BF-40** minimal slice shipped ([`WMS_OUTBOUND_ASN_BF40.md`](./WMS_OUTBOUND_ASN_BF40.md)); **BF-41** minimal slice shipped ([`WMS_RETURNS_BF41.md`](./WMS_RETURNS_BF41.md)); **BF-42** minimal slice shipped ([`WMS_QA_SAMPLING_BF42.md`](./WMS_QA_SAMPLING_BF42.md)); **BF-43** minimal slice shipped ([`WMS_LOGISTICS_UNITS_BF43.md`](./WMS_LOGISTICS_UNITS_BF43.md)); **BF-44** minimal slice shipped ([`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md)); **BF-45** minimal slice shipped ([`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md)). Capsules **BF-46** … **BF-50** remain **draft** until executed.

**Rules:**

1. **Do not** bundle BF-31 … BF-50 into one prompt unless product explicitly funds a program sprint — each ID is a separate thematic capsule.
2. Ship → update **[`GAP_MAP.md`](./GAP_MAP.md)** → refresh **[`BF_CAPSULE_ROADMAP.md`](./BF_CAPSULE_ROADMAP.md)** → add/adjust **`docs/wms/*`** theme notes when a capsule lands.
3. Stay inside **`src/app/wms/**`, **`src/app/api/wms/**`, **`src/lib/wms/**`** unless the row explicitly names CRM/CT/platform/integrations — then touch shared surfaces minimally.

---

## Program rollup

| ID | Mega phase (short) | Primary deferred signal ([`GAP_MAP.md`](./GAP_MAP.md)) | Typical depends on |
|----|-------------------|--------------------------------------------------------|---------------------|
| **BF-31** | GRN references & ASN tolerance policies | **Minimal landed** — **`asnQtyTolerancePct`**, **`WmsReceipt.grnReference`**, **`evaluate_wms_receipt_asn_tolerance`**, guarded **`close_wms_receipt`** ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)); carrier ASN hub backlog | BF-21 receipt accounting |
| **BF-32** | Receiving accrual & finance staging hooks | **Minimal landed** — **`WmsReceivingAccrualStaging`** + **`GET /api/wms/receiving-accrual-staging`** ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)); GL posting / tax backlog | BF-21 / Phase B billing |
| **BF-33** | Carton DIM / cube-aware greedy allocation | Cube / weight inputs on allocation hints beyond **`pickWaveCartonUnits`** | BF-15 / BF-23 strategies |
| **BF-34** | MILP / CP-SAT allocation prototype | Minimal **`SOLVER_PROTOTYPE_*`** strategies ([`WMS_ALLOCATION_BF34.md`](./WMS_ALLOCATION_BF34.md)); env **`WMS_ENABLE_BF34_SOLVER=1`** | BF-33 cube hints |
| **BF-35** | Replenishment automation & priority queues | **`ReplenishmentRule`** depth + exception queues | BF-03 / stock inquiry stable |
| **BF-36** | ATP / soft reservations on outbound | Available-to-promise preview + reservation TTL | Outbound + balance ledger |
| **BF-37** | Cross-dock / flow-through shipment tagging | **`Shipment`** or dock flags → skip putaway path | Inbound + outbound linkage |
| **BF-38** | Dock door optimization & trailer checks | Door-window solver / trailer checklist on **`WmsDockAppointment`** | BF-05 / BF-17 dock depth |
| **BF-39** | Production carrier label purchase | **Minimal landed** — **`purchase_carrier_label`**, HTTP JSON bridge (`WMS_CARRIER_LABEL_HTTP_URL`), persisted **`OutboundOrder.carrierTrackingNo`** / **`carrierLabelAdapterId`** ([`WMS_CARRIER_LABEL_BF39.md`](./WMS_CARRIER_LABEL_BF39.md)); carrier certify backlog | BF-29 scan + label hooks |
| **BF-40** | Outbound ASN / DESADV export | **Minimal landed** — **`GET /api/wms/outbound-asn-export`**, DESADV-inspired JSON + Vitest builder ([`WMS_OUTBOUND_ASN_BF40.md`](./WMS_OUTBOUND_ASN_BF40.md)); EDI certify backlog | Outbound ship confirmation |
| **BF-41** | Returns & RMA receiving workflow | **Minimal landed** — **`Shipment.wmsInboundSubtype`**, RMA + optional **`returnSourceOutboundOrderId`**, **`ShipmentItem.wmsReturnDisposition`**, putaway/hold policy ([`WMS_RETURNS_BF41.md`](./WMS_RETURNS_BF41.md)); refund automation backlog | BF-01 variance / holds |
| **BF-42** | QA sampling & receiving disposition templates | **Minimal landed** — **`WmsReceivingDispositionTemplate`**, line QA hints + **`apply_wms_disposition_template_to_shipment_item`** ([`WMS_QA_SAMPLING_BF42.md`](./WMS_QA_SAMPLING_BF42.md)); LIMS / enforced AQL backlog | QC row / holds |
| **BF-43** | GS1 license plate & nested logistics units | **Minimal landed** — **`WmsOutboundLogisticsUnit`**, **`upsert_outbound_logistics_unit_bf43`** / **`delete_outbound_logistics_unit_bf43`**, payload **`logisticsUnits`**, BF-29 multiset substitution (`verifyOutboundPackScanWithLogisticsUnits`) ([`WMS_LOGISTICS_UNITS_BF43.md`](./WMS_LOGISTICS_UNITS_BF43.md)); EPCIS backlog | BF-08 / BF-29 labeling |
| **BF-44** | Outbound webhooks / event subscriptions | **Minimal landed** — subscriptions + HMAC `sha256=<hex>` + delivery rows + immediate POST + backoff + cron retries ([`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md), [`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md)) | Audit + idempotency patterns (**BF-25**) |
| **BF-45** | Partner REST API (scoped reads + keys) | **Minimal landed** — `WmsPartnerApiKey`, `GET /api/wms/partner/v1/*`, Setup UI + OpenAPI stub ([`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md)); OAuth marketplace / enforced rate limits backlog | Platform auth patterns |
| **BF-46** | SAML / OIDC IdP federation (**BF-30** depth) | JWKS / SAML assertion validation vs HMAC bridge | BF-30 portal SSO |
| **BF-47** | Posted billing disputes & credit memo stubs | Dispute after invoice post + credit linkage | BF-28 billing events |
| **BF-48** | Field-level WMS ACL matrix completion | Per-field mutation matrix beyond **`BF-16`** coarse tiers | BF-06 RBAC tiers |
| **BF-49** | Operational timeline / unified audit feed | Cross-surface timeline (**CT** + **WMS**) from **`CtAuditLog`** / movements | WE-08 audit discipline |
| **BF-50** | Topology graph export & twin-readiness | **`WarehouseAisle`** adjacency / export for simulation overlays | BF-24 aisle masters |

**Suggested dependency-aware sequence (not mandatory):** BF-31 → BF-32 (receiving truth → finance hooks); BF-33 → BF-34 (deterministic cube hints → optional solver); BF-35 parallel inventory ops; BF-36 after outbound ledger semantics stable; BF-37 / BF-38 when dock product owns cross-flow; BF-39 after BF-29 patterns; BF-40 with commercial/EDI ownership; BF-41 / BF-42 with QA ownership; BF-43 with labeling/compliance; BF-44 / BF-45 when integrations/platform fund APIs; BF-46 after BF-30 usage; BF-47 with finance; BF-48 governance spike; BF-49 narrative/dashboard ownership; BF-50 after **`WarehouseAisle`** adoption (**BF-24**).

---

## BF-31 — GRN references & ASN tolerance policies

**Objective:** Close the gap between **BF-21** dock receipts and finance/carrier-grade **GRN** references: ASN tolerance rules, partial receipts vs ASN lines, optional auto-close when within tolerance.

**Minimal slice shipped (repo):** **`Shipment.asnQtyTolerancePct`**; **`WmsReceipt.grnReference`**; **`evaluate_wms_receipt_asn_tolerance`**; **`close_wms_receipt`** extensions (**`grnReference`**, **`generateGrn`**, **`requireWithinAsnToleranceForAdvance`**, **`blockCloseIfOutsideTolerance`**); **`set_shipment_inbound_fields`** tolerance patch; Operations inbound UI + closed history **GRN** chip; Vitest **`asn-receipt-tolerance.test.ts`** — [`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md).

**Exit sketch (remaining):** Carrier ASN ingestion (855/JSON); centralized GRN issuer; tolerance matrices per SKU/category.

**Out of scope:** Full carrier ASN hub, multi-leg consolidation engines.

---

## BF-32 — Receiving accrual & finance staging hooks

**Objective:** Stage receiving economics for accounting (**accrual**, GRNI) without full ERP posting — aligned with Phase B billing materialization.

**Minimal slice shipped (repo):** **`WmsReceivingAccrualStaging`** created inside **`close_wms_receipt`** transaction (**`snapshotJson`** v1 line economics + PO refs + GRN); **`crmAccountId`** from **`Shipment.customerCrmAccountId`**; **`GET /api/wms/receiving-accrual-staging`** JSON + **`format=csv`** (+ **`since`**/**`until`**); Operations billing UI preview + CSV download — [`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md).

**Exit sketch (remaining):** Post **`WmsReceivingAccrualStaging`** into **`WmsBillingEvent`** or finance webhook when product funds ERP adapters; warehouse hints on staging (`warehouseId` populated).

**Out of scope:** Tax engine, multi-currency hedge, automatic GL posts.

---

## BF-33 — Carton DIM / cube-aware greedy allocation

**Objective:** Extend **BF-15** / **BF-23** heuristics with **SKU carton dims** and optional **bin / outbound cube** hints so greedy allocation prefers feasible bin sequences before MILP (**BF-34**).

**Exit sketch (minimal slice):** Shipped — optional **`Product`** carton fields + **`WarehouseBin.capacityCubeCubicMm`** + **`OutboundOrder.estimatedCubeCbm`** in **`GET /api/wms`**; **`GREEDY_*_CUBE_AWARE`** strategies; Vitest in **`carton-cube-allocation.test.ts`**. See [`WMS_ALLOCATION_BF33.md`](./WMS_ALLOCATION_BF33.md).

**Out of scope:** CAD SKU meshes, conveyor physics.

---

## BF-34 — MILP / CP-SAT allocation prototype

**Objective:** Optional **solver-backed** bin assignment for pick waves where product funds complexity — behind feature flag.

**Exit sketch (minimal slice):** Shipped — bounded **minimal slot-cardinality subset** enumeration + BF-15/BF-23 follow-on ordering (`SOLVER_PROTOTYPE_*`), gated by **`WMS_ENABLE_BF34_SOLVER`**. See [`WMS_ALLOCATION_BF34.md`](./WMS_ALLOCATION_BF34.md).

**Out of scope:** Real-time labor heatmaps, slotting optimizer unified with replenishment, general-purpose MILP/CP-SAT engine.

---

## BF-35 — Replenishment automation & priority queues

**Objective:** Deepen **`ReplenishmentRule`** execution: priorities, exception queues, batch **`create_replenishment_tasks`** improvements.

**Shipped (minimal slice):** See [`WMS_REPLENISHMENT_BF35.md`](./WMS_REPLENISHMENT_BF35.md) — rule **`priority`**, **`maxTasksPerRun`**, **`exceptionQueue`**; sorted batch create; task snapshots; Operations REPLENISH filters (tier + min priority).

**Out of scope:** Full automated slotting across network DCs.

---

## BF-36 — ATP / soft reservations on outbound

**Objective:** **Available-to-promise** preview and **soft reservations** on **`InventoryBalance`** (or parallel reservation rows) with TTL for high-touch commercial workflows.

**Shipped (minimal slice):** See [`WMS_ATP_BF36.md`](./WMS_ATP_BF36.md) — **`WmsInventorySoftReservation`**, **`create_soft_reservation`** / **`release_soft_reservation`**, ATP + balance columns + active list on **`GET /api/wms`**, picks / waves / replenishment respect soft qty.

**Out of scope:** Global ATP across tenants, legacy ERP ATP synchronization.

---

## BF-37 — Cross-dock / flow-through shipment tagging

**Objective:** Mark inbound **`Shipment`** (or dock receipts) for **cross-dock** / **flow-through** to reduce putaway when outbound demand is known.

**Shipped (minimal slice):** See [`WMS_CROSS_DOCK_BF37.md`](./WMS_CROSS_DOCK_BF37.md) — **`Shipment.wmsCrossDock` / `wmsFlowThrough`**, **`WarehouseBin.isCrossDockStaging`**, Operations filtering + inbound tags, **`create_bin` / `update_bin_profile`**, allocation prefers staging bins among ties.

**Out of scope:** Yard automation, automated slotting to dock doors.

---

## BF-38 — Dock door optimization & trailer checks

**Objective:** Extend **`WmsDockAppointment`** with **door assignment**, **trailer checklist**, and simple **window compression** suggestions.

**Shipped (minimal slice):** See [`WMS_DOCK_BF38.md`](./WMS_DOCK_BF38.md) — optional **`doorCode`** + **`trailerChecklistJson`**, **`update_dock_appointment_bf38`**, DEPARTED checklist gate for required rows, optional **`WMS_BF38_REQUIRE_DOOR_BEFORE_AT_DOCK`** on AT_DOCK, **`nextDockAppointmentWindowStart`** hint on **`GET /api/wms`**, Operations UI.

**Out of scope:** Full TMS solver, labor scheduling solver.

---

## BF-39 — Production carrier label purchase

**Objective:** Replace **`DEMO_PARCEL`** with at least one **production-grade** carrier adapter (purchase label + persist tracking refs).

**Shipped (minimal slice):** See [`WMS_CARRIER_LABEL_BF39.md`](./WMS_CARRIER_LABEL_BF39.md) — shared purchase types + env router (`demo_parcel` / `http_json`), **`purchase_carrier_label`** persists **`carrierTrackingNo`** / **`carrierLabelAdapterId`** / **`carrierLabelPurchasedAt`** + **`CtAuditLog`**, HTTPS JSON bridge with Vitest-mocked fetch; Operations UI primary **Purchase carrier label**; **`request_demo_carrier_label`** remains non-persisting synthetic preview.

**Out of scope:** Rate shopping across all carriers, freight audit.

---

## BF-40 — Outbound ASN / DESADV export

**Objective:** Generate **ship-notice** payloads (**DESADV**/ASN JSON or EDI stub) when outbound ships — customer-visible milestones.

**Shipped (minimal slice):** See [`WMS_OUTBOUND_ASN_BF40.md`](./WMS_OUTBOUND_ASN_BF40.md) — **`GET /api/wms/outbound-asn-export`** (`outboundOrderId`, optional `pretty=1`), **`buildOutboundDesadvSnapshotV1`** + Vitest, CRM/outbound read-scope parity, Operations **Export ASN JSON** on **PACKED** / **SHIPPED**.

**Out of scope:** Full EDIFACT/X12 certification library.

---

## BF-41 — Returns & RMA receiving workflow

**Objective:** First-class **customer returns** path: RMA reference, disposition (**scrap**/ **restock**/ **quarantine**), linkage to original outbound optional.

**Shipped (minimal slice):** See [`WMS_RETURNS_BF41.md`](./WMS_RETURNS_BF41.md) — enums + **`Shipment`** / **`ShipmentItem`** columns; **`set_shipment_inbound_fields`** BF-41 keys; **`set_shipment_item_return_disposition`** + audit; putaway blocks **SCRAP**, **QUARANTINE** applies hold after putaway; Operations inbound grid + line **Return disp.** + filter.

**Out of scope:** Refund orchestration, marketplace multi-channel returns.

---

## BF-42 — QA sampling & receiving disposition templates

**Objective:** Configurable **sampling plans** (e.g. skip-lot / fixed percentage) on inbound lines with templated **disposition** notes.

**Shipped (minimal slice):** See [`WMS_QA_SAMPLING_BF42.md`](./WMS_QA_SAMPLING_BF42.md) — template CRUD (Setup tier), **`ShipmentItem`** sampling flags + default template FK, **`apply_wms_disposition_template_to_shipment_item`** substituting tokens into **`wmsVarianceNote`**, Operations QA column + audit hooks.

**Out of scope:** Full LIMS, regulated pharma validation package.

---

## BF-43 — GS1 license plate & nested logistics units

**Objective:** **Nested SSCC / LPN** hierarchy for pallets→cases→eaches beyond BF-08 demo SSCC.

**Exit sketch (minimal slice):** Parent/child LPN entities + pack scan validation hook (**BF-29**) — shipped as **`WmsOutboundLogisticsUnit`** + **`verifyOutboundPackScanWithLogisticsUnits`** — [`WMS_LOGISTICS_UNITS_BF43.md`](./WMS_LOGISTICS_UNITS_BF43.md).

**Out of scope:** Full EPCIS trace registry.

---

## BF-44 — Outbound webhooks / event subscriptions ✅ **Minimal landed**

**Objective:** Tenant-configurable **signed outbound webhooks** for milestones (receive close, ship, billing dispute) mirroring idempotency lessons from **BF-25**.

**Shipped:** [`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md) — `WmsOutboundWebhookSubscription` / `WmsOutboundWebhookDelivery`, POST actions (`create_wms_outbound_webhook_subscription_bf44`, …), `emitWmsOutboundWebhooks` + Vitest, Setup UI panel, hooks after `close_wms_receipt`, `mark_outbound_shipped`, billing dispute; **`GET /api/cron/wms-outbound-webhook-retries`** (BF-45) retries failed deliveries.

**Deferred:** DLQ UI / replay tooling (**BF-49** overlap).

**Out of scope:** Kafka/Azure Event Grid managed connectors.

---

## BF-45 — Partner REST API (scoped reads + keys) ✅ **Minimal landed**

**Objective:** **API keys** + scoped **`GET`** endpoints for partners / 3PL customers (inventory snapshot, shipment status) — complements **BF-30** portal UX.

**Shipped:** [`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md) — `WmsPartnerApiKey`, scopes `INVENTORY_READ` / `OUTBOUND_READ`, `POST /api/wms` issue/revoke, `GET /api/wms/partner/v1/inventory-balances`, `GET /api/wms/partner/v1/outbound-orders/[id]`, advisory rate-limit headers (stub), [`openapi-partner-v1.yaml`](./openapi-partner-v1.yaml). Cron **`/api/cron/wms-outbound-webhook-retries`** drains BF-44 failed webhook deliveries (Bearer `CRON_SECRET`).

**Out of scope:** OAuth marketplace, full developer billing.

---

## BF-46 — SAML / OIDC IdP federation (**BF-30** depth)

**Objective:** Replace or augment **HMAC SSO bridge** with **OIDC code flow** or **SAML** assertion validation (**JWKS**, **`aud`/`iss`** checks).

**Exit sketch (minimal slice):** Env-driven IdP metadata + token exchange → same **`po_auth_user`** session semantics as **BF-30**.

**Out of scope:** Multi-org B2B IdP federation hub, step-up MFA product.

---

## BF-47 — Posted billing disputes & credit memo stubs

**Objective:** Extend **BF-28** disputes to **posted** invoice runs: credit memo placeholders, reversal linkage, AR sync hooks.

**Exit sketch (minimal slice):** Status machine on billing runs + dispute reason codes + read APIs + UI read-only badges.

**Out of scope:** Full AR subledger, tax reversal automation.

---

## BF-48 — Field-level WMS ACL matrix completion

**Objective:** Finish blueprint **per-field** mutation matrix beyond **`BF-16`** **`org.wms.inventory.lot`** — manifest-driven gates.

**Exit sketch (minimal slice):** Manifest YAML/json loaded server-side + centralized gate helper + Vitest matrix snapshots.

**Out of scope:** Dynamic ABAC from external PDP.

---

## BF-49 — Operational timeline / unified audit feed

**Objective:** Single **tenant timeline** blending **`CtAuditLog`**, WMS movements, dock milestones for **`/control-tower`** or **`/wms`** exec surfaces.

**Exit sketch (minimal slice):** **`GET /api/.../timeline`** with cursors + filters + caps; CT/WMS shared component stub.

**Out of scope:** SIEM export, petabyte retention.

---

## BF-50 — Topology graph export & twin-readiness

**Objective:** Export **`WarehouseAisle`** **adjacency** / **bin graph** (nodes/edges) for simulation vendors — extends **BF-24** mm-backed topology.

**Exit sketch (minimal slice):** **`GET /api/wms`** or **`POST export_warehouse_topology_graph`** returns JSON graph + coordinate hints.

**Out of scope:** Live AGV orchestration, Unity/Unreal twin runtime.

---

## Prompt stub (copy for any BF-31 … BF-50 issue)

> Execute capsule **BF-xx** from [`docs/wms/BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) and the matching row in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Stay inside WMS module boundaries unless the row explicitly includes CRM/CT/platform/integrations. Deliver: schema/migrations if needed, API actions, minimal UI, tests, **`GAP_MAP`** + capsule roadmap updates, commit message referencing **BF-xx**.

---

_Last updated: 2026-04-29 — **BF-45** partner API keys + scoped reads + webhook retry cron ([`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md)); **BF-44** outbound webhooks minimal ([`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md)); **BF-43** outbound logistics units + BF-29 pack-scan multiset hook ([`WMS_LOGISTICS_UNITS_BF43.md`](./WMS_LOGISTICS_UNITS_BF43.md)); **BF-42** QA sampling + disposition templates minimal ([`WMS_QA_SAMPLING_BF42.md`](./WMS_QA_SAMPLING_BF42.md)); **BF-41** customer returns + RMA receiving minimal ([`WMS_RETURNS_BF41.md`](./WMS_RETURNS_BF41.md)); **BF-40** outbound ASN / DESADV JSON export ([`WMS_OUTBOUND_ASN_BF40.md`](./WMS_OUTBOUND_ASN_BF40.md)); **BF-39** carrier label router + HTTP JSON bridge + persisted tracking ([`WMS_CARRIER_LABEL_BF39.md`](./WMS_CARRIER_LABEL_BF39.md)); **BF-38** dock door + trailer checklist + milestone guards ([`WMS_DOCK_BF38.md`](./WMS_DOCK_BF38.md)); **BF-37** cross-dock / flow-through tags + staging preference ([`WMS_CROSS_DOCK_BF37.md`](./WMS_CROSS_DOCK_BF37.md)); **BF-36** ATP / soft reservations minimal landed ([`WMS_ATP_BF36.md`](./WMS_ATP_BF36.md)); **BF-35** replenishment priority / exception tier ([`WMS_REPLENISHMENT_BF35.md`](./WMS_REPLENISHMENT_BF35.md)); **BF-34** solver prototype ([`WMS_ALLOCATION_BF34.md`](./WMS_ALLOCATION_BF34.md)); **BF-33** cube-aware greedy ([`WMS_ALLOCATION_BF33.md`](./WMS_ALLOCATION_BF33.md)); **BF-32** receiving accrual staging ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)); **BF-31** GRN + ASN qty tolerance ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)); **BF-46**–**BF-50** draft objectives._
