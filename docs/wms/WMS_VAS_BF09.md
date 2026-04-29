# VAS portal intake & BOM costing snapshot (BF-09)

**Purpose:** Extend **WE-04** VAS work orders ([`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md)) with **CRM-linked intake**, explicit **portal vs ops** origin, and **manual commercial estimates** (material cents + labor minutes) ahead of full BOM engines or automated billing rules.

**Authority:** Capsule **BF-09** ([`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md)).

---

## Schema (`WmsWorkOrder`)

| Field | Meaning |
|-------|---------|
| **`intakeChannel`** | `OPS` (floor-created) or **`CUSTOMER_PORTAL`** (submitted via `/wms/vas-intake`). |
| **`crmAccountId`** | Optional **`CrmAccount`** counterparty (quotes/billing alignment — same tenant patterns as outbound CRM handoff). |
| **`estimatedMaterialsCents`** | Integer whole cents — manual BOM / assembly snapshot for quoting. |
| **`estimatedLaborMinutes`** | Non-negative integer — planning labor before engineered standards. |

## API (`POST /api/wms`)

| Action | Notes |
|--------|--------|
| **`create_work_order`** | Ops intake (**`OPS`**); optional **`workOrderCrmAccountId`**. |
| **`request_customer_vas_work_order`** | Requires **`warehouseId`**, **`workOrderTitle`**, **`crmAccountId`**; creates **`CUSTOMER_PORTAL`** row. |
| **`set_work_order_commercial_estimate`** | **`workOrderId`** + **`estimatedMaterialsCents`** and/or **`estimatedLaborMinutes`** — use **`null`** on a field to clear it. |

Tier mapping (**BF-06**): operations ([`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md)).

## UI

| Surface | Behavior |
|---------|----------|
| **`/wms/vas-intake`** | Authenticated shell; requires **`org.wms` → view** and **`org.crm` → view**; submit requires **`org.wms.operations` → edit** (or full **`org.wms` → edit**). |
| **Operations → Value-add** | Ops-created WOs optional CRM select; list shows **Portal/Ops** badge, CRM name, **Save estimate** for materials $ + labor min. |

## Explicit backlog

- Customer SSO portal (tenant-branded) beyond authenticated demo shell.
- Multi-line BOM assemblies and automated rollup into **`wmsBillingEvents`** from **`ADJUSTMENT`** contexts.
- VAS SKU pricing matrices attached to **`CrmAccount`** contracts.

_Last updated: 2026-04-29 — BF-09 shipped._
