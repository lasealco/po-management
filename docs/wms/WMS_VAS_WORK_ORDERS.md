# WMS value-add services — work orders (ADR snapshot)

## Decision

Model blueprint **VAS / work orders** as a tenant-scoped **`WmsWorkOrder`** header (`workOrderNo`, title, description, status per warehouse) with **`WmsTask` rows** of type **`VALUE_ADD`** linked via **`referenceType = WMS_WORK_ORDER`** and **`referenceId = WmsWorkOrder.id`**.

## Entities

| Piece | Role |
|-------|------|
| `WmsWorkOrder` | Operational ticket (`OPEN` → `IN_PROGRESS` → `DONE` / `CANCELLED`). |
| `WmsTask` (`VALUE_ADD`) | Executable step; optional **`productId`/`binId`/`quantity`** for consumption vs labor-only (`quantity` `0`, null product/bin). |
| `InventoryMovement` (`ADJUSTMENT`) | Posted only when completing a material **`VALUE_ADD`** task (`referenceType: VALUE_ADD_TASK`). |

## Flows

1. **`create_work_order`** — scoped warehouse + title; audit **`CtAuditLog`** (`work_order_created`, entity `WMS_WORK_ORDER`).
2. **`create_value_add_task`** — attaches step to an **`OPEN`/`IN_PROGRESS`** work order; bumps WO to **`IN_PROGRESS`**.
3. **`complete_value_add_task`** — if material: validates bin/product/on-hand + hold checks; writes **`ADJUSTMENT`** decrement; marks task **`DONE`**; when no **`OPEN`** `VALUE_ADD` remains on WO, sets WO **`DONE`** + **`completedAt`**; audit **`value_add_task_completed`**.

## Billing (Phase B hook)

Outbound-linked **`PICK`**/**`SHIPMENT`** movements remain the primary **`wmsBillingEvents`** path today.

Material **`VALUE_ADD`** completion emits **`ADJUSTMENT`** only (`VALUE_ADD_TASK` reference). **Invoice-line rollup against outbound-linked CRM accounts is unchanged**; treat extended Phase B **VAS SKU pricing / assembly BOM costing** as a future billing-rules increment unless product attaches billing profiles to adjustment contexts explicitly.

## MVP limits

- No BOM/multi-component assemblies beyond single balance consumption row per task (commercial **`estimatedMaterialsCents`** on WO header is a manual snapshot — BF-09 [`WMS_VAS_BF09.md`](./WMS_VAS_BF09.md)).
- **Authentication-required** customer intake shell at **`/wms/vas-intake`** (`request_customer_vas_work_order`) — SSO-branded supplier/customer portal backlog.
