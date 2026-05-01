# BF-26 — VAS engineering BOM sync (minimal slice)

**Purpose:** Close part of the **BF-18 → BF-26** gap: push an engineering BOM snapshot from **CRM quote lines** into **`WmsWorkOrderBomLine`** with explicit revision metadata and a stub **variance** signal vs the ops **`estimatedMaterialsCents`** header.

**Authority:** Program capsule [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-26; VAS model [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md).

---

## What shipped (repo)

| Piece | Role |
|-------|------|
| **`CrmQuoteLine.engineeringBomRevision`** | Optional ECO / revision label (`VarChar(128)`). |
| **`CrmQuoteLine.engineeringBomLines`** | JSON array of `{ sku, plannedQty, lineNo?, lineNote? }` (`componentSku` alias accepted). |
| **`CrmQuoteLine.engineeringBomMaterialsCents`** | Optional CRM rollup (whole cents) for variance vs WO estimate. |
| **`PATCH /api/crm/quotes/[id]/lines/[lineId]`** | Validates and persists the three fields above (`engineeringBomLines: null` clears JSON). |
| **`WmsWorkOrder.crmQuoteLineId`** | FK to linked CPQ line (`onDelete: SetNull`). |
| **`WmsWorkOrder.engineeringBomSyncedRevision` / `engineeringBomSyncedAt`** | Last successful WMS sync markers. |
| **`link_work_order_crm_quote_line`** | **`workOrderId`** + **`crmQuoteLineId`** (string or **`null`** unlink). Requires quote-line **`quote.accountId`** = WO **`crmAccountId`** when both set. Clears sync columns on unlink. |
| **`sync_work_order_bom_from_crm_quote_line`** | Maps SKUs → **`Product.id`** (tenant), replaces BOM snapshot **only** while WO **`OPEN`/`IN_PROGRESS`** and **no** line has **`consumedQty` > 0** (same freeze as **`replace_work_order_bom_lines`**). Updates sync columns; audit **`work_order_engineering_bom_synced`**. |
| **`create_work_order`** | Optional **`crmQuoteLineId`** with same account guard. |
| **`GET /api/wms`** | Work orders expose link/sync fields + **`crmEngineeringBom*`** + **`materialsEstimateVsEngineeringVarianceCents`** (`estimatedMaterialsCents − engineeringBomMaterialsCents` when both present). |
| **Operations UI** | Quote line id link/unlink, **Sync BOM from CRM**, variance line when CRM rollup + estimate exist. |
| **Lib** | [`src/lib/wms/engineering-bom-sync.ts`](../../src/lib/wms/engineering-bom-sync.ts) — parse + resolve; Vitest **`engineering-bom-sync.test.ts`**. |

---

## Operator checklist

1. CRM user patches quote line with **`engineeringBomRevision`**, **`engineeringBomLines`** (SKUs must match tenant **`Product.sku`**), optional **`engineeringBomMaterialsCents`**.
2. WMS ops creates or links **`WmsWorkOrder`** to that **`CrmQuoteLine`** (`link_work_order_crm_quote_line` or **`create_work_order`**).
3. Ops runs **Sync BOM from CRM** before any BOM consumption posts.
4. Compare **Δ Estimate − CRM engineering materials** on the WO card when both cents fields are set.

---

## Backlog (explicit)

- PLM / nightly MRP regeneration, engineering webhook ingress, consumption-aware ECO (partial revise with **`consumedQty` > 0**).
- Cost rollup from **`Product`** standard costs (no **`standardCostCents`** today — CRM rollup is manual/integrator-fed).

---

_Last updated: 2026-04-29 — BF-26 minimal engineering BOM sync + CRM PATCH + WMS POST actions._
