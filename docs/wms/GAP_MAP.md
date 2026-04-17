# WMS blueprint (R1–R3) ↔ codebase — gap map

**Purpose:** Phase A exit — map `wms_blueprint_and_technical_prd` **Release 1–3** scope to **Prisma + `/api/wms`** and list intentional gaps before new tables.

**Legend:** ✅ covered · 🟡 partial / simplified · ❌ not in schema or not wired

**Phase A / R1–R2 demo exit (this repo):** setup + receiving/putaway + stock inquiry (ledger + balance filter + CSV) + outbound pick/pack/ship + holds + replenishment tasks + waves + cycle count + inbound ASN fields + **shipment milestones** (log + last milestone in UI) + billing event materialization to CRM account where linked. **Explicitly deferred:** zone hierarchy beyond flat zone/bin, lot master, field-level WMS permission matrix, multi-strategy allocation, dock appointments, VAS/work orders, commercial quotes (see R3).

## R1 — Foundation (setup, receiving path basics, inquiry, outbound basic, permissions)

| Blueprint area | Repo reality | Notes |
|----------------|--------------|--------|
| Warehouse / site | ✅ `Warehouse` | CFS vs WAREHOUSE; tenant-scoped |
| Zone / aisle / bay… | 🟡 `WarehouseZone` + `WarehouseBin` | Flat zone + bin; optional **`rackCode` / `aisle` / `bay` / `level` / `positionIndex`** on bins for rack addressing + **Setup rack front map** (2D grid + on-hand text); still no mm-level geometry or 3D |
| Dock / staging / quarantine as concepts | 🟡 Zone **types** + bin **storageType** | Enum-driven, not separate dock entities |
| Customer (3PL owner) | 🟡 | Optional `OutboundOrder.crmAccountId` → `CrmAccount` (same tenant); WMS UI + `set_outbound_crm_account`; linking requires `org.crm` → view |
| SKU / UOM / lot rules | 🟡 `Product` | Shared with PO catalog; no WMS-specific lot master on item |
| Permissions / audit | 🟡 `org.wms` + `User` on movements | No field-level WMS matrix from `wms_role_permission_matrix` yet |
| **Inbound ASN** | 🟡 **Orders + `Shipment` / `ShipmentItem`** | `Shipment.asnReference` + `expectedReceiveAt`; WMS inbound table + `set_shipment_inbound_fields`; putaway unchanged |
| Receiving / putaway | ✅ `WmsTask` PUTAWAY + `InventoryMovement` PUTAWAY | Matches “directed putaway” at demo depth |
| **Inventory inquiry** | ✅ `InventoryBalance` + **movement ledger** 🟡 | Stock page: server ledger filters `mvWarehouse`, `mvType`, `mvSince`/`mvUntil`, `mvLimit` (≤300); **client text filter** on balances; **Export CSV** for visible ledger rows |
| Outbound order | 🟡 `OutboundOrder` / `OutboundOrderLine` | Pick → **Mark packed** → **Mark shipped** (`SHIPMENT` movements); CRM link locked after pack |
| Allocation | 🟡 Line `allocatedQty` on balance + pick tasks | Not full multi-strategy allocation engine |

## R2 — Inbound depth, QC, replenishment UI, packing, waves, counts

| Blueprint area | Repo reality |
|----------------|--------------|
| QC / quarantine holds | 🟡 `InventoryBalance.onHold` + `holdReason`; picks / wave allocation skip held bins; UI on Stock page |
| Appointment scheduling | ❌ |
| Replenishment execution | 🟡 `ReplenishmentRule` + `create_replenishment_tasks` + REPLENISH tasks | Verify UI covers REPLENISH |
| Wave planning | 🟡 `WmsWave` + release/complete | |
| Packing / labels | 🟡 Line `packedQty` exists; limited workflow | |
| Cycle count | 🟡 `CYCLE_COUNT` tasks: create from balance + complete with counted qty → `ADJUSTMENT` |
| Dashboards | 🟡 | `/wms` **At a glance** counts (open tasks, outbound, waves, balances, unbilled events, 7d movements) |

## R3 — VAS, portal, advanced allocation, billing events

| Blueprint area | Repo reality |
|----------------|--------------|
| VAS / work orders | ❌ Phase C / separate epic |
| Billing events | 🟡 **Phase B in repo** — events carry **`crmAccountId`** + `profileSource` from outbound-linked PICK/SHIP movements; invoice run `CRM_ACCOUNT` when all events share one account; UI shows CRM column |
| Commercial / quotes | ❌ **Phase C** (CRM or commercial module) |

## Existing API actions (`POST /api/wms`)

`create_zone`, `create_bin`, `update_bin_profile`, `set_replenishment_rule`, `create_replenishment_tasks`, `create_outbound_order` (optional `crmAccountId`), `set_outbound_crm_account`, `release_outbound_order`, `create_putaway_task`, `complete_putaway_task`, `create_pick_task`, `create_pick_wave`, `release_wave`, `complete_wave`, `complete_pick_task`, `mark_outbound_packed`, `mark_outbound_shipped`, `set_shipment_inbound_fields`, `record_shipment_milestone`, `set_balance_hold`, `clear_balance_hold`, `complete_replenish_task`, `create_cycle_count_task`, `complete_cycle_count_task`.

Handlers live in `src/lib/wms/post-actions.ts` (route stays a thin shell).

## Near-term build order (Phase A continuation)

1. **Movement visibility + filters** — **done:** ledger query params + stock UI + **CSV export** for current rows.  
2. **Hold / QC** — **done:** `onHold` / `holdReason` on `InventoryBalance` + UI.  
3. **`WmsCustomer`** or reuse **CRM `CrmAccount`** — **done** for outbound (optional link + `set_outbound_crm_account`).  
4. Split `src/app/api/wms/route.ts` into `src/lib/wms/*.ts` — **done:** `post-actions.ts` (POST), `get-wms-payload.ts` (GET), `wms-body.ts`, `wave.ts`, billing modules.

_Next optional increments:_ saved ledger views, outbound ASN parity, deeper receiving states — not required for Phase A exit above.

_Last updated: inbound milestones UI, open-task type filter, balance search, movement CSV, GAP_MAP refresh._
