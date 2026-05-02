# Inventory freeze matrix (BF-58 minimal)

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-58; RBAC alignment **BF-48** ([`WMS_RBAC_BF48.md`](./WMS_RBAC_BF48.md)); complements **BF-16** holds on `InventoryBalance` and **BF-41** customer-return quarantine putaway.

## Goals (landed)

| Surface | Behavior |
|--------|-----------|
| **Schema** | `holdReasonCode`, `holdAppliedAt`, `holdAppliedById`, `holdReleaseGrant` on **`InventoryBalance`**. |
| **POST** | **`apply_inventory_freeze`** — `holdReasonCode` (`QC_HOLD`, `RECALL`, `REGULATORY`, `DAMAGED`, `INVESTIGATION`, `CUSTOMER_RETURN`, `OTHER`), optional `holdReason` / `freezeNote`, optional `holdReleaseGrant` (`org.wms.inventory.hold.release_quality` \| `…release_compliance`). Target: `balanceId` **or** `freezeScopeWarehouseId` + `freezeScopeProductId` (+ optional `freezeScopeLotCode`) for bulk rows. |
| **POST** | **`release_inventory_freeze`** — same as **`clear_balance_hold`** with BF-58 release matrix: standard holds need full inventory edit; restricted holds require the stored grant → **edit** (or full inventory / legacy WMS edit). |
| **Legacy** | **`set_balance_hold`** sets `holdReasonCode = OTHER` + audit columns; **`clear_balance_hold`** clears matrix fields. |
| **RBAC** | New catalog rows: **`org.wms.inventory.hold.release_{quality,compliance}`** view/edit. Gate: delegated users with either grant may call release actions; handler enforces per-row grant + standard-hold inventory edit. |
| **UI** | **`/wms/stock`** — hold code badge, “restricted” hint, **BF-58** apply control, **Clear** uses **`release_inventory_freeze`**. |
| **Partner** | **`GET /api/wms/partner/v1/inventory-balances`** exposes freeze metadata. |

## Out of scope

Regulatory recall portal broadcast, FDA submission flows, multi-tier approval workflows.

_Last updated: 2026-04-30 — BF-58 minimal landed._
