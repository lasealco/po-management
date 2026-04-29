# WMS blueprint (R1–R3) ↔ codebase — gap map

**Purpose:** Phase A exit — map `wms_blueprint_and_technical_prd` **Release 1–3** scope to **Prisma + `/api/wms`** and list intentional gaps before new tables.

**Enterprise finish line (prompt-by-capsule):** [`ENTERPRISE_TRACK.md`](./ENTERPRISE_TRACK.md) — **WE-01** … **WE-12**.

**Legend:** ✅ covered · 🟡 partial / simplified · ❌ not in schema or not wired

**Phase A / R1–R2 demo exit (this repo):** setup + receiving/putaway + stock inquiry (ledger + balance filter + CSV) + outbound pick/pack/ship + holds + replenishment tasks + waves + cycle count + inbound ASN fields + **shipment milestones** (log + last milestone in UI) + billing event materialization to CRM account where linked + **VAS / work orders** MVP (`WmsWorkOrder`, **`VALUE_ADD`** tasks — [`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md)) + **lot/batch buckets on balances** ([`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md)). **Explicitly deferred:** zone hierarchy beyond flat zone/bin, **full** serialization / lot-master regulatory depth (beyond balance-scoped `lotCode`), field-level WMS permission matrix, multi-strategy allocation, **full TMS / yard automation** (minimal dock windows shipped — see [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md)), commercial quotes (see R3).

> **Tranche handoff (2026-04-26):** Optional increments **2.1** (saved ledger), **2.2** (outbound ASN), and **2.4** (REPLENISH source→target) are **closed** on `main`. **2.3** receiving states: **Option A** implemented (`WmsReceiveStatus` on `Shipment`, `GET /api/wms` `allowedReceiveActions`, `set_wms_receiving_status`, `CtAuditLog`) — see [`WMS_RECEIVING_OPTION_A.md`](./WMS_RECEIVING_OPTION_A.md); line-level variance remains backlog. **Dock appointments (WE-02):** `WmsDockAppointment` + overlap checks — [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md). **Allocation (WE-03):** warehouse pick strategies — [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md). Other **🟡 / ❌** rows remain MVP or deferred — see [`CONTROL_TOWER_WMS_PHASED_ROADMAP` § Program tranche handoff](../engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md#program-tranche-handoff-2026-04-26).

## R1 — Foundation (setup, receiving path basics, inquiry, outbound basic, permissions)

| Blueprint area | Repo reality | Notes |
|----------------|--------------|--------|
| Warehouse / site | ✅ `Warehouse` | CFS vs WAREHOUSE; tenant-scoped |
| Zone / aisle / bay… | 🟡 `WarehouseZone` + `WarehouseBin` | Flat zone + bin; optional **`rackCode` / `aisle` / `bay` / `level` / `positionIndex`** on bins for rack addressing + **Setup rack front map** (2D grid + on-hand text); still no mm-level geometry or 3D |
| Dock / staging / quarantine as concepts | 🟡 Zone **types** + bin **storageType** | Enum-driven, not separate dock entities |
| Customer (3PL owner) | 🟡 | Optional `OutboundOrder.crmAccountId` → `CrmAccount` (same tenant); WMS UI + `set_outbound_crm_account`; linking requires `org.crm` → view |
| SKU / UOM / lot rules | 🟡 **`Product`** + **`InventoryBalance.lotCode`** | Shared catalog SKU; batch buckets per bin/SKU ([`WMS_LOT_SERIAL_DECISION.md`](./WMS_LOT_SERIAL_DECISION.md)). Full serial genealogy / standalone lot master table still backlog |
| Permissions / audit | 🟡 `org.wms` + `User` on movements | No field-level WMS matrix from `wms_role_permission_matrix` yet |
| **Inbound ASN** | 🟡 **Orders + `Shipment` / `ShipmentItem`** | `Shipment.asnReference` + `expectedReceiveAt`; **`wmsReceiveStatus`** (+ note/timestamps/user) + [`set_wms_receiving_status`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md) / [`WMS_RECEIVING_OPTION_A.md`](./WMS_RECEIVING_OPTION_A.md); WMS inbound table + `set_shipment_inbound_fields`; putaway unchanged — **no** line-level receipt variance table yet |
| Receiving / putaway | ✅ `WmsTask` PUTAWAY + `InventoryMovement` PUTAWAY | Matches “directed putaway” at demo depth |
| **Inventory inquiry** | ✅ `InventoryBalance` + **movement ledger** 🟡 | Stock page: server ledger filters `mvWarehouse`, `mvType`, `mvSince`/`mvUntil`, `mvLimit` (≤300); **client text filter** on balances; **Export CSV** for visible ledger rows; **per-user saved ledger views** (`WmsSavedLedgerView`, `GET/POST /api/wms/saved-ledger-views`, `DELETE …/[id]`) |
| Outbound order | 🟡 `OutboundOrder` / `OutboundOrderLine` | Pick → **Mark packed** → **Mark shipped** (`SHIPMENT` movements); **ASN ref** (`asnReference`) + **requested ship** (`requestedShipDate`) on order; WMS **Outbound flow** + `set_outbound_order_asn_fields` / `create_outbound_order` (optional); CRM link locked after pack |
| Allocation | 🟡 **`Warehouse.pickAllocationStrategy`** (`MAX_AVAILABLE_FIRST` \| `FIFO_BY_BIN_CODE` \| `MANUAL_ONLY`) + `orderPickSlotsForWave` tests | Staged profiles only — wave picks policy-gated; `MANUAL_ONLY` blocks auto waves; explicit `create_pick_task` unchanged. No FEFO / solver / multi-strategy engine ([`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md)) |

## R2 — Inbound depth, QC, replenishment UI, packing, waves, counts

| Blueprint area | Repo reality |
|----------------|--------------|
| QC / quarantine holds | 🟡 `InventoryBalance.onHold` + `holdReason`; picks / wave allocation skip held bins; UI on Stock page |
| Appointment scheduling | 🟡 `WmsDockAppointment` + `GET/POST /api/wms` | Tenant-scoped dock code + window + inbound shipment or outbound order link; **overlap blocked** for `SCHEDULED`; cancel action; WMS Operations UI — not TMS/carrier automation ([`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md)) |
| Replenishment execution | 🟡 `ReplenishmentRule` + `create_replenishment_tasks` + REPLENISH tasks | **Open tasks** (Operations) show **source → target** bin per task (`sourceBin` + `bin` in `GET /api/wms`); setup has short copy pointing to the list |
| Wave planning | 🟡 `WmsWave` + release/complete | |
| Packing / labels | 🟡 Line `packedQty` exists; limited workflow | |
| Cycle count | 🟡 `CYCLE_COUNT` tasks: create from balance + complete with counted qty → `ADJUSTMENT` |
| Dashboards | 🟡 | `/wms` **At a glance** counts (open tasks, outbound, waves, balances, unbilled events, 7d movements) |

## R3 — VAS, portal, advanced allocation, billing events

| Blueprint area | Repo reality |
|----------------|--------------|
| VAS / work orders | 🟡 **`WmsWorkOrder`** + **`VALUE_ADD`** tasks (`create_work_order`, `create_value_add_task`, `complete_value_add_task`); labor-only or single-row consumption → **`ADJUSTMENT`** on complete ([`WMS_VAS_WORK_ORDERS.md`](./WMS_VAS_WORK_ORDERS.md)). Portal intake / BOM costing still backlog |
| Billing events | 🟡 **Phase B in repo** — events carry **`crmAccountId`** + `profileSource` from outbound-linked PICK/SHIP movements; invoice run `CRM_ACCOUNT` when all events share one account; UI shows CRM column |
| Commercial / quotes | ❌ **Phase C** (CRM or commercial module) |

## Existing API actions (`POST /api/wms`)

`create_zone`, `create_bin`, `update_bin_profile`, `set_replenishment_rule`, `create_replenishment_tasks`, `create_outbound_order` (optional `crmAccountId`, optional `asnReference` + `requestedShipDate`), `set_outbound_crm_account`, `set_outbound_order_asn_fields`, `release_outbound_order`, `create_putaway_task`, `complete_putaway_task`, `create_pick_task`, `create_pick_wave`, `set_warehouse_pick_allocation_strategy`, `release_wave`, `complete_wave`, `complete_pick_task`, `mark_outbound_packed`, `mark_outbound_shipped`, `set_shipment_inbound_fields`, `set_wms_receiving_status`, `create_dock_appointment`, `cancel_dock_appointment`, `record_shipment_milestone`, `set_balance_hold`, `clear_balance_hold`, `complete_replenish_task`, `create_cycle_count_task`, `complete_cycle_count_task`, `create_work_order`, `create_value_add_task`, `complete_value_add_task`.

Handlers live in `src/lib/wms/post-actions.ts` (route stays a thin shell).

## Near-term build order (Phase A continuation)

1. **Movement visibility + filters** — **done:** ledger query params + stock UI + **CSV export** for current rows.  
2. **Hold / QC** — **done:** `onHold` / `holdReason` on `InventoryBalance` + UI.  
3. **`WmsCustomer`** or reuse **CRM `CrmAccount`** — **done** for outbound (optional link + `set_outbound_crm_account`).  
4. Split `src/app/api/wms/route.ts` into `src/lib/wms/*.ts` — **done:** `post-actions.ts` (POST), `get-wms-payload.ts` (GET), `wms-body.ts`, `wave.ts`, billing modules.

_Next optional increments:_ ~~saved ledger views~~ (**landed** 2026-04-23: `WmsSavedLedgerView` + `/api/wms/saved-ledger-views`); ~~**outbound ASN** parity~~ (**landed** 2026-04-25: `OutboundOrder.asnReference` + `requestedShipDate` in payload + `set_outbound_order_asn_fields`); **2.3 deeper receiving states** — **Option A landed** 2026-04-29 (`WmsReceiveStatus`, `set_wms_receiving_status`, audit); line variance still backlog — see [WMS_RECEIVING_STATE_MACHINE_SPEC.md](./WMS_RECEIVING_STATE_MACHINE_SPEC.md). **Dock appointments** — **WE-02 landed** 2026-04-29 ([`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md)); TMS/yard automation still out of scope. **Allocation profiles** — **WE-03 landed** 2026-04-29 ([`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md)); FEFO/solver engines still out of scope.

_Last updated: 2026-04-29 — WE-05 balance-scoped lot codes (`InventoryBalance.lotCode`, `WmsTask.lotCode`); WE-04 VAS work orders; WE-03 allocation; WE-02 dock; Phase 2.3 receiving (Option A); 2026-04-26 tranche handoff._
