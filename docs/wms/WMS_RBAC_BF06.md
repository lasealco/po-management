# BF-06 — WMS scoped mutation tiers (coarse capability split)

**Goal:** Move beyond a single **`org.wms` → `edit`** gate toward blueprint-style **separation of duties**, **without** per-field ACLs or a `wms_role_permission_matrix` table — WE-08 coarse HTTP grants remain the backbone ([`WMS_RBAC_AND_AUDIT.md`](./WMS_RBAC_AND_AUDIT.md)).

## Permission rows (`GLOBAL_PERMISSION_CATALOG`)

| Resource | Actions | Covers |
|----------|---------|--------|
| **`org.wms.setup`** | view / edit | Zones, bins, replenishment **rules**, warehouse **allocation strategy** |
| **`org.wms.operations`** | view / edit | Task execution, waves, dock appointments + yard milestones, inbound/outbound mutations, VAS / work orders, **WMS billing** POST (`/api/wms/billing`) |
| **`org.wms.inventory`** | view / edit | Balance holds, cycle counts, **saved ledger views** (`/api/wms/saved-ledger-views`), and inventory-tier **`POST /api/wms`** mutations except **`set_wms_lot_batch`** (**BF-16** **`inventory.lot`**) and manifest-listed serialization registry actions (**BF-48** **`inventory.serial`**) when granted standalone |
| **`org.wms.inventory.lot`** | view / edit | **`WmsLotBatch`** via **`set_wms_lot_batch`** without **`org.wms.inventory` → edit** (**BF-16**) |
| **`org.wms.inventory.serial`** | view / edit | Serialization registry POST actions listed in **`wms-field-acl-matrix.json`** (`register_inventory_serial`, `set_inventory_serial_balance`, `attach_inventory_serial_to_movement`) without full **`org.wms.inventory` → edit** (**BF-48**) |

Legacy **`org.wms` → `edit`** still implies **full** mutation access (backward compatible).

## Runtime rule

For each **`POST /api/wms`** `action`, allow mutation iff:

`org.wms` → **edit** **OR** `org.wms.{setup|operations|inventory}` → **edit** for the mapped tier, **except** inventory-tier actions refined under **BF-16** + **BF-48** (`src/lib/wms/wms-field-acl-matrix.json`):

- **`set_wms_lot_batch`** — **`org.wms` → edit** OR **`org.wms.inventory` → edit** OR **`org.wms.inventory.lot` → edit**
- **Serialization registry actions** (manifest `serialRegistryOnly`) — **`org.wms` → edit** OR **`org.wms.inventory` → edit** OR **`org.wms.inventory.serial` → edit**
- **Other inventory-tier actions** — **`org.wms` → edit** OR **`org.wms.inventory` → edit** (`inventory.lot` / **`inventory.serial`** alone are insufficient)

Implementation: `wmsMutationTierForPostAction` in `src/lib/wms/wms-mutation-tiers.ts` + `gateWmsPostMutation` in `src/lib/wms/wms-mutation-grants.ts` + **`evaluateWmsInventoryPostMutationAccess`** in `src/lib/wms/wms-inventory-field-acl.ts`.

## UI

Workspace pages pass section-aware **`canEdit`** (`viewerHasWmsSectionMutationEdit`): Setup → **setup**, Operations (+ Billing shell) → **operations**, Stock → **inventory** (opens with **`inventory.lot`** and/or **`inventory.serial`** alone for partial edit). Stock also receives **`inventoryQtyEdit`** / **`inventoryLotEdit`** / **`inventorySerialEdit`** from **`viewerHasWmsInventoryQtyMutationEdit`** / **`viewerHasWmsInventoryLotMutationEdit`** / **`viewerHasWmsInventorySerialMutationEdit`**.

## Residual backlog

Row-per-blueprint-matrix grants in SQL, per-field deny rules inside JSON payloads, ABAC by warehouse, or a dedicated RBAC schema row per blueprint matrix row — still **out of scope** beyond **BF-16** / **BF-48** manifest slices ([`WMS_RBAC_BF48.md`](./WMS_RBAC_BF48.md)).
