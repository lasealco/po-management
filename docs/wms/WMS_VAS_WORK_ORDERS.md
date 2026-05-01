# WMS value-add services — work orders (ADR snapshot)

## Decision

Model blueprint **VAS / work orders** as a tenant-scoped **`WmsWorkOrder`** header (`workOrderNo`, title, description, status per warehouse) with **`WmsTask` rows** of type **`VALUE_ADD`** linked via **`referenceType = WMS_WORK_ORDER`** and **`referenceId = WmsWorkOrder.id`**.

## Entities

| Piece | Role |
|-------|------|
| `WmsWorkOrder` | Operational ticket (`OPEN` → `IN_PROGRESS` → `DONE` / `CANCELLED`). |
| `WmsTask` (`VALUE_ADD`) | Executable step; optional **`productId`/`binId`/`quantity`** for consumption vs labor-only (`quantity` `0`, null product/bin). |
| `WmsWorkOrderBomLine` | BF-18 exploded BOM snapshot per WO (`plannedQty` vs **`consumedQty`** ledger); unique **`lineNo`** per WO. |
| `InventoryMovement` (`ADJUSTMENT`) | Posted when completing a material **`VALUE_ADD`** task (`referenceType: VALUE_ADD_TASK`) **or** posting **`consume_work_order_bom_line`** (**`referenceType: WO_BOM_LINE`**, **`referenceId`**: BOM line id). |

## Flows

1. **`create_work_order`** — scoped warehouse + title; audit **`CtAuditLog`** (`work_order_created`, entity `WMS_WORK_ORDER`).
2. **`create_value_add_task`** — attaches step to an **`OPEN`/`IN_PROGRESS`** work order; bumps WO to **`IN_PROGRESS`**.
3. **`complete_value_add_task`** — if material: validates bin/product/on-hand + hold checks; writes **`ADJUSTMENT`** decrement; marks task **`DONE`**; when no **`OPEN`** `VALUE_ADD` remains on WO, sets WO **`DONE`** + **`completedAt`**; audit **`value_add_task_completed`**.
4. **`replace_work_order_bom_lines`** — **`workOrderId`** + **`bomLines[]`** (`componentProductId`, **`plannedQty`**, optional **`lineNo`**, **`lineNote`**); allowed only while WO **`OPEN`/`IN_PROGRESS`** and **every** line has **`consumedQty` = 0**; replaces snapshot; audit **`work_order_bom_replaced`**.
5. **`consume_work_order_bom_line`** — **`bomLineId`**, **`binId`**, **`quantity`**, optional **`lotCode`** (defaults via **`normalizeLotCode`**); validates bin in WO warehouse, balance/hold/on-hand, cumulative consume ≤ **`plannedQty`**; increments **`consumedQty`**; **`ADJUSTMENT`** + **`WO_BOM_LINE`** ref; audit **`work_order_bom_line_consumed`**.
6. **`link_work_order_crm_quote_line`** (**BF-26**) — attach **`WmsWorkOrder.crmQuoteLineId`** (tenant **`CrmQuoteLine`**); requires **`quote.accountId`** match WO **`crmAccountId`** when both set; audit **`work_order_crm_quote_line_linked`**.
7. **`sync_work_order_bom_from_crm_quote_line`** (**BF-26**) — maps **`CrmQuoteLine.engineeringBomLines`** (`sku` → **`Product.sku`**) into **`replace_work_order_bom_lines`**-equivalent snapshot (**consumption freeze** unchanged); audit **`work_order_engineering_bom_synced`**.

## Billing (Phase B hook)

Outbound-linked **`PICK`**/**`SHIPMENT`** movements remain the primary **`wmsBillingEvents`** path today.

Material **`VALUE_ADD`** completion emits **`ADJUSTMENT`** (`VALUE_ADD_TASK` reference). BOM line consumption emits **`ADJUSTMENT`** with **`WO_BOM_LINE`**. **Invoice-line rollup against outbound-linked CRM accounts is unchanged**; treat extended Phase B **VAS SKU pricing / assembly BOM costing** as a future billing-rules increment unless product attaches billing profiles to adjustment contexts explicitly.

## MVP limits

- **`VALUE_ADD`** tasks remain **single-row** consumption per task; multi-component assemblies use **`WmsWorkOrderBomLine`** + **`consume_work_order_bom_line`** (BF-18). Commercial **`estimatedMaterialsCents`** on the WO header stays a **manual** snapshot vs engineered BOM until **`CrmQuoteLine.engineeringBomMaterialsCents`** is maintained (**BF-26** variance on **`GET /api/wms`**) — [`WMS_VAS_BF09.md`](./WMS_VAS_BF09.md), [`WMS_ENGINEERING_BOM_BF26.md`](./WMS_ENGINEERING_BOM_BF26.md).
- **Authentication-required** customer intake shell at **`/wms/vas-intake`** (`request_customer_vas_work_order`) — SSO-branded supplier/customer portal backlog.

_Last updated: 2026-04-29 — BF-26 CRM engineering BOM PATCH + WMS sync + variance stub._
