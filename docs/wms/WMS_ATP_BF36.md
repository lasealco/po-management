# BF-36 — ATP / soft reservations on outbound (minimal slice)

## Purpose

Time-boxed **soft reservations** reduce **available-to-promise (ATP)** on specific **`InventoryBalance`** rows without changing **`allocatedQty`** (pick allocations still use `allocatedQty`). **`create_pick_task`**, **`create_pick_wave`**, **`create_replenishment_tasks`**, and **`complete_replenish_task`** respect soft reservations when computing effective availability.

## Data model

- **`WmsInventorySoftReservation`** — `inventoryBalanceId`, `quantity`, `expiresAt`, optional `referenceType` / `referenceId` / `note`, `createdById`. Rows with `expiresAt <= now()` are ignored for ATP (no background job required for MVP).

## API

- **`create_soft_reservation`** — `balanceId`, `quantity`; optional `softReservationTtlSeconds` (default **3600**), or `softReservationExpiresAt` (ISO, future); optional `softReservationRefType`, `softReservationRefId`, `softReservationNote`.
- **`release_soft_reservation`** — `softReservationId`.

Tier: **`inventory`** (`org.wms.inventory → edit` or legacy **`org.wms → edit`**).

## Reads (`GET /api/wms`)

- **`atpByWarehouseProduct`** — aggregated on-hand, allocated, soft-reserved, and ATP per warehouse × product.
- **`balances[]`** — `softReservedQty`, **`effectiveAvailableQty`** (= on-hand − allocated − active soft on that balance).
- **`softReservations`** — active rows (cap 200), scoped like balances.

## UI

Stock workspace: **ATP & soft reservations** panel (summary table, create form, release list).

## References

- Phase capsule: [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) § BF-36.
