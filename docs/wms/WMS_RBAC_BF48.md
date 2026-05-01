# BF-48 — Field-level WMS ACL matrix (serial slice)

**Goal:** Extend **BF-16** so **`POST /api/wms`** inventory-tier mutations follow a **versioned manifest** not only for lot-metadata (`set_wms_lot_batch`) but also for **serialization registry** actions, enabling **`org.wms.inventory.serial` → edit** without full **`org.wms.inventory` → edit**.

## Catalog / grants

- **`org.wms.inventory.serial`** view / edit rows live in **`GLOBAL_PERMISSION_CATALOG`** (`src/lib/permission-catalog.ts`).
- **`viewerHasWmsInventorySerialMutationEdit`** in **`src/lib/authz.ts`** mirrors runtime gates (legacy **`org.wms`**, full **`org.wms.inventory`**, or **`inventory.serial`** only).

## Manifest + classification

- **`src/lib/wms/wms-field-acl-matrix.json`** — **`inventory.lotMetadataOnly`**, **`inventory.serialRegistryOnly`**, **`version`**.
- **`src/lib/wms/wms-field-acl-matrix.ts`** — `loadWmsFieldAclMatrix`, `inventoryAclKindForAction`.
- **`src/lib/wms/wms-inventory-field-acl.ts`** — **`evaluateWmsInventoryPostMutationAccess`**:
  - **`lot_metadata`** — legacy **`org.wms.edit`** OR **`org.wms.inventory.edit`** OR **`org.wms.inventory.lot.edit`**
  - **`serial_registry`** — legacy OR full inventory OR **`org.wms.inventory.serial.edit`**
  - **`full_inventory`** — legacy OR full **`org.wms.inventory.edit`** (all other inventory-tier actions covered by the matrix buckets).

## Runtime wiring

- **`src/lib/wms/wms-mutation-grants.ts`** — loads serial-tier grants and passes **`inventorySerialEdit`** into **`evaluateWmsInventoryPostMutationAccess`** when mutating against the **`inventory`** coarse tier.
- **`src/lib/wms/wms-mutation-tiers.ts`** — coarse **`inventory`** tier; BF-48 refinement documented alongside BF-16.

## Stock UI

- **`src/app/wms/stock/page.tsx`** passes **`inventorySerialEdit`** into **`WmsClient`**.
- **`src/components/wms-client.tsx`** — serialization mutation shell when **`stockQtyEdit || stockSerialEdit`**; amber “limited edit” banner when **`inventory.lot`** and/or **`inventory.serial`** apply without qty-path edit.

## Tests

- **`src/lib/wms/wms-inventory-field-acl.test.ts`**
- **`src/lib/wms/wms-field-acl-matrix.test.ts`**

## Out of scope

External PDP / ABAC, blueprint **`wms_role_permission_matrix`** as SQL.
