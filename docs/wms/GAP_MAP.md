# WMS blueprint (R1–R3) ↔ codebase — gap map

**Purpose:** Phase A exit — map `wms_blueprint_and_technical_prd` **Release 1–3** scope to **Prisma + `/api/wms`** and list intentional gaps before new tables.

**Legend:** ✅ covered · 🟡 partial / simplified · ❌ not in schema or not wired

## R1 — Foundation (setup, receiving path basics, inquiry, outbound basic, permissions)

| Blueprint area | Repo reality | Notes |
|----------------|--------------|--------|
| Warehouse / site | ✅ `Warehouse` | CFS vs WAREHOUSE; tenant-scoped |
| Zone / aisle / bay… | 🟡 `WarehouseZone` + `WarehouseBin` | Flat zone + bin; no deeper hierarchy |
| Dock / staging / quarantine as concepts | 🟡 Zone **types** + bin **storageType** | Enum-driven, not separate dock entities |
| Customer (3PL owner) | ❌ | Inventory is tenant + `Product`; no `WmsCustomer` yet |
| SKU / UOM / lot rules | 🟡 `Product` | Shared with PO catalog; no WMS-specific lot master on item |
| Permissions / audit | 🟡 `org.wms` + `User` on movements | No field-level WMS matrix from `wms_role_permission_matrix` yet |
| **Inbound ASN** | 🟡 **Orders + `Shipment` / `ShipmentItem`** | Operational putaway ties to shipment lines, not a first-class ASN model |
| Receiving / putaway | ✅ `WmsTask` PUTAWAY + `InventoryMovement` PUTAWAY | Matches “directed putaway” at demo depth |
| **Inventory inquiry** | ✅ `InventoryBalance` + **movement ledger** 🟡 | Balances in UI; ledger now exposed (recent rows) — full search/filter later |
| Outbound order | ✅ `OutboundOrder` / `OutboundOrderLine` | Statuses through picking |
| Allocation | 🟡 Line `allocatedQty` on balance + pick tasks | Not full multi-strategy allocation engine |

## R2 — Inbound depth, QC, replenishment UI, packing, waves, counts

| Blueprint area | Repo reality |
|----------------|--------------|
| QC / quarantine holds | ❌ No `InventoryHold` / quarantine status on balance |
| Appointment scheduling | ❌ |
| Replenishment execution | 🟡 `ReplenishmentRule` + `create_replenishment_tasks` + REPLENISH tasks | Verify UI covers REPLENISH |
| Wave planning | 🟡 `WmsWave` + release/complete | |
| Packing / labels | 🟡 Line `packedQty` exists; limited workflow | |
| Cycle count | 🟡 `CYCLE_COUNT` task type in schema | Wire / UX TBD |
| Dashboards | ❌ |

## R3 — VAS, portal, advanced allocation, billing events

| Blueprint area | Repo reality |
|----------------|--------------|
| VAS / work orders | ❌ Phase C / separate epic |
| Billing events | 🟡 **Phase B in repo** — `WmsBillingRate`, `WmsBillingEvent`, `WmsBillingInvoiceRun` / `Line`; `/api/wms/billing` + `/wms/billing` UI; PDF rate matrix not replicated field-for-field |
| Commercial / quotes | ❌ **Phase C** (CRM or commercial module) |

## Existing API actions (`POST /api/wms`)

`create_zone`, `create_bin`, `update_bin_profile`, `set_replenishment_rule`, `create_replenishment_tasks`, `create_outbound_order`, `release_outbound_order`, `create_putaway_task`, `complete_putaway_task`, `create_pick_task`, `create_pick_wave`, `release_wave`, `complete_wave`, `complete_pick_task`.

## Near-term build order (Phase A continuation)

1. **Movement visibility + filters** — recent ledger in GET + WMS UI table; **stock page** filters by warehouse + movement type.  
2. **Hold / QC** minimal model or status flags on `InventoryBalance` (design choice in next increment).  
3. **`WmsCustomer`** or reuse **CRM `CrmAccount`** for 3PL owner linkage — decision before deep inbound.  
4. Split `src/app/api/wms/route.ts` into `src/lib/wms/*.ts` handlers per strategy doc (started: `lib/wms/wave.ts`, `lib/wms/billing-*`).

_Last updated: Phase B billing foundation shipped._
