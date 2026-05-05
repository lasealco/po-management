# VMI / consignment ownership metadata — BF-79 (minimal)

**Purpose:** Tag **`InventoryBalance`** rows as **company-owned** (default) vs **vendor / consignment** using an optional **`Supplier`** FK — metadata for 3PL billing narratives, not consignment invoicing.

**Authority:** [`BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) §BF-79.

## Schema

- **`InventoryBalance.inventoryOwnershipSupplierIdBf79`** — nullable FK → **`Supplier`** (`onDelete: SetNull`). **`null`** means company-owned stock.

## POST (`/api/wms`)

| Action | Tier | Purpose |
|--------|------|---------|
| **`set_inventory_balance_ownership_bf79`** | inventory | **`balanceId`** + **`inventoryOwnershipSupplierIdBf79`** (active tenant supplier), or **`inventoryOwnershipSupplierIdBf79Clear: true`** → company-owned. |

## GET (`GET /api/wms`)

- **`balances`** — include **`inventoryOwnershipSupplierIdBf79`** and resolved **`inventoryOwnershipSupplierBf79`** `{ id, code, name }` when set.
- **`suppliersBf79`** — active suppliers (≤400) for picker / narrow filters.
- **`inventoryOwnershipBalanceFilterBf79`** — echo of applied filter (`bf79.v1`).
- **Query params** (optional):
  - **`balanceOwnership`** = `company` → rows with null FK; `vendor` → rows with non-null FK.
  - **`balanceOwnershipSupplierId`** — restrict to that supplier’s consignment rows (wins over `balanceOwnership` when both present).

## UI

- **`/wms/stock`** — Stock balances: ownership column + server-side ownership/supplier filters.

## Out of scope

Consignment invoicing, PO-driven automatic ownership assignment, ERP ownership sync.

_Last updated: 2026-04-29 — BF-79 minimal slice._
