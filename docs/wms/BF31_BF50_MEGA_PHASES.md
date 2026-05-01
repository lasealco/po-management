# BF-31 … BF-50 — blueprint mega phases (post BF-30)

**Purpose:** Define the **next twenty blueprint-finish capsules** after **`BF-21` … `BF-30`** using the same discipline: one capsule = one review gate, explicit **`GAP_MAP`** signals when shipped, minimal viable schema/API/UI before declaring partial ✅.

**Authority:** Parent catalog rows live in [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md). Prior shipped waves: [`BF12_BF20_MEGA_PHASES.md`](./BF12_BF20_MEGA_PHASES.md), [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md).

**Status:** **BF-31** minimal slice shipped ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)); **BF-32** minimal slice shipped ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)); **BF-33** minimal slice shipped ([`WMS_ALLOCATION_BF33.md`](./WMS_ALLOCATION_BF33.md)); **BF-34** minimal slice shipped ([`WMS_ALLOCATION_BF34.md`](./WMS_ALLOCATION_BF34.md)); **BF-35** minimal slice shipped ([`WMS_REPLENISHMENT_BF35.md`](./WMS_REPLENISHMENT_BF35.md)). Capsules **BF-36** … **BF-50** remain **draft** until executed.

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
| **BF-39** | Production carrier label purchase | Real vendor adapters beyond **`DEMO_PARCEL`** (**BF-29**) | BF-29 scan + label hooks |
| **BF-40** | Outbound ASN / DESADV export | Customer ship notices + carrier milestone payloads | Outbound ship confirmation |
| **BF-41** | Returns & RMA receiving workflow | Disposition + QA path for **`CUSTOMER_RETURN`**-style inbound | BF-01 variance / holds |
| **BF-42** | QA sampling & receiving disposition templates | AQL / sampling plans on **`Shipment`** or receipt lines | QC row / holds |
| **BF-43** | GS1 license plate & nested logistics units | Nested SSCC / LPN hierarchy beyond demo SSCC | BF-08 / BF-29 labeling |
| **BF-44** | Outbound webhooks / event subscriptions | Signed **`POST`** callbacks for ship/receive milestones | Audit + idempotency patterns (**BF-25**) |
| **BF-45** | Partner REST API (scoped reads + keys) | Tenant API keys + read scopes for inventory/shipment slices | Platform auth patterns |
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

**Exit sketch (minimal slice):** Reservation **`POST`/`DELETE`** actions + **`GET /api/wms`** ATP summary per SKU/wh; picks respect reservations.

**Out of scope:** Global ATP across tenants, legacy ERP ATP synchronization.

---

## BF-37 — Cross-dock / flow-through shipment tagging

**Objective:** Mark inbound **`Shipment`** (or dock receipts) for **cross-dock** / **flow-through** to reduce putaway when outbound demand is known.

**Exit sketch (minimal slice):** Flags + Operations filtering + guardrails when allocating outbound to staged cross-dock bins.

**Out of scope:** Yard automation, automated slotting to dock doors.

---

## BF-38 — Dock door optimization & trailer checks

**Objective:** Extend **`WmsDockAppointment`** with **door assignment**, **trailer checklist**, and simple **window compression** suggestions.

**Exit sketch (minimal slice):** Optional **`doorCode`** / checklist JSON + validation on yard milestones (**BF-05**).

**Out of scope:** Full TMS solver, labor scheduling solver.

---

## BF-39 — Production carrier label purchase

**Objective:** Replace **`DEMO_PARCEL`** with at least one **production-grade** carrier adapter (purchase label + persist tracking refs).

**Exit sketch (minimal slice):** Vendor adapter interface + one carrier implementation + secrets/config doc + Vitest with mocked HTTP.

**Out of scope:** Rate shopping across all carriers, freight audit.

---

## BF-40 — Outbound ASN / DESADV export

**Objective:** Generate **ship-notice** payloads (**DESADV**/ASN JSON or EDI stub) when outbound ships — customer-visible milestones.

**Exit sketch (minimal slice):** **`GET`** export or **`POST`** webhook companion (**BF-44**) for **`mark_outbound_shipped`** events; template doc.

**Out of scope:** Full EDIFACT/X12 certification library.

---

## BF-41 — Returns & RMA receiving workflow

**Objective:** First-class **customer returns** path: RMA reference, disposition (**scrap**/ **restock**/ **quarantine**), linkage to original outbound optional.

**Exit sketch (minimal slice):** Inbound subtype + UI tab + receiving actions + inventory postings aligned with holds (**BF-02**/QC).

**Out of scope:** Refund orchestration, marketplace multi-channel returns.

---

## BF-42 — QA sampling & receiving disposition templates

**Objective:** Configurable **sampling plans** (e.g. skip-lot / fixed percentage) on inbound lines with templated **disposition** notes.

**Exit sketch (minimal slice):** Template CRUD + optional **`ShipmentItem`** sampling flags + audit.

**Out of scope:** Full LIMS, regulated pharma validation package.

---

## BF-43 — GS1 license plate & nested logistics units

**Objective:** **Nested SSCC / LPN** hierarchy for pallets→cases→eaches beyond BF-08 demo SSCC.

**Exit sketch (minimal slice):** Parent/child LPN entities or JSON tree + pack scan validation hook (**BF-29**).

**Out of scope:** Full EPCIS trace registry.

---

## BF-44 — Outbound webhooks / event subscriptions

**Objective:** Tenant-configurable **signed outbound webhooks** for milestones (receive close, ship, billing dispute) mirroring idempotency lessons from **BF-25**.

**Exit sketch (minimal slice):** Subscription table + HMAC signing + retry backoff stub + Vitest.

**Out of scope:** Kafka/Azure Event Grid managed connectors.

---

## BF-45 — Partner REST API (scoped reads + keys)

**Objective:** **API keys** + scoped **`GET`** endpoints for partners / 3PL customers (inventory snapshot, shipment status) — complements **BF-30** portal UX.

**Exit sketch (minimal slice):** Key issuance **`POST`**, scope enum, rate-limit middleware stub, OpenAPI fragment.

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

_Last updated: 2026-04-29 — **BF-35** replenishment priority / exception tier minimal landed ([`WMS_REPLENISHMENT_BF35.md`](./WMS_REPLENISHMENT_BF35.md)); **BF-34** solver prototype minimal landed ([`WMS_ALLOCATION_BF34.md`](./WMS_ALLOCATION_BF34.md)); **BF-33** cube-aware greedy minimal landed ([`WMS_ALLOCATION_BF33.md`](./WMS_ALLOCATION_BF33.md)); **BF-32** receiving accrual staging minimal landed ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)); **BF-31** GRN + ASN qty tolerance ([`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md)); **BF-36**–**BF-50** draft objectives._
