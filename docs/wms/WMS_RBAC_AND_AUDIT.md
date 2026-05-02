# WMS RBAC and audit (WE-08)

## Enterprise stance vs blueprint field matrix

Blueprint references a granular **`wms_role_permission_matrix`**. This repo does **not** implement a full per-row permission table.

**BF-06 (2026-04-29):** Three **scoped mutation tiers** — **`org.wms.setup`**, **`org.wms.operations`**, **`org.wms.inventory`** — each with **view / edit**, layered on legacy **`org.wms` → `edit`**. See [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md).

**BF-16 (2026-04-29):** **`org.wms.inventory.lot`** (view / edit) narrows **lot/batch master** writes: **`set_wms_lot_batch`** is allowed with **`inventory.lot` → edit** alone. **BF-48:** **`org.wms.inventory.serial`** (view / edit) narrows **serialization registry** writes listed in **`wms-field-acl-matrix.json`**. All **other** inventory-tier **`POST /api/wms`** actions still require **`org.wms.inventory` → edit** or legacy **`org.wms` → edit**. Manifest + evaluator: **`src/lib/wms/wms-field-acl-matrix.json`**, **`src/lib/wms/wms-inventory-field-acl.ts`**; **`/api/wms/saved-ledger-views`** POST/DELETE remain **`org.wms.inventory` → edit** only (qty-operator persona).

**Chosen alternative (Phase A–B):**

| Layer | Mechanism |
|-------|-----------|
| **Coarse HTTP auth** | Global grants **`org.wms` → `view`** / **`edit`** on **`/api/wms`** GET; **`POST`** actions gated by tier map **or** legacy **`org.wms` → `edit`** ([`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md)), with **BF-16** / **BF-48** inventory-tier splits driven by the manifest. Nested routes: **`/api/wms/billing`** POST → **operations** tier; **`/api/wms/saved-ledger-views`** POST/DELETE → **`org.wms.inventory` → edit** (not **`inventory.lot`** / **`inventory.serial`** alone). |
| **Server UI gate** | **`WmsGate`** (`src/app/wms/wms-gate.tsx`) requires **`org.wms` → `view`** before rendering any `/wms/**` shell |
| **Read scoping** | **`loadWmsViewReadScope`** narrows inbound shipments, outbound orders, CRM-linked payloads, product division filters — consistent with PO/CRM/Control Tower |
| **Mutations** | Section-aware **`canEdit`** from **`viewerHasWmsSectionMutationEdit`** (Setup / Operations / Stock / Billing billing shell uses **operations** tier); **Stock** also passes **`inventoryQtyEdit`** / **`inventoryLotEdit`** / **`inventorySerialEdit`** when qty vs lot vs serial separation applies (**BF-16**, **BF-48**) |
| **CRM outbound link** | **`assertOutboundCrmAccountLinkable`** enforces **`org.crm` → view** + CRM list scope |
| **Evidence** | **`InventoryMovement.createdById`** on posted quantities; **`CtAuditLog`** on selected transitions (below) |

Further **field-level** slices extend **`wms-field-acl-matrix.json`** + **`evaluateWmsInventoryPostMutationAccess`** + **`gateWmsPostMutation`** — optional tightening beyond BF-06 tier split (**BF-16** lot metadata; **BF-48** serial registry — [`WMS_RBAC_BF48.md`](./WMS_RBAC_BF48.md)).

## HTTP enforcement inventory

Aligned with **`src/lib/wms/wms-api-grants.ts`** (Vitest guard).

| Surface | Method | Grant |
|---------|--------|-------|
| `/api/wms` | GET | `org.wms` → view — dashboard payload; **`homeKpis=1`** subset; **`topologyGraph=1&warehouseId=`** returns **BF-50** topology JSON ([`WMS_TOPOLOGY_BF50.md`](./WMS_TOPOLOGY_BF50.md)) |
| `/api/wms` | POST | **`org.wms` → edit** **or** scoped **`org.wms.{setup|operations|inventory}` → edit** per `action` ([`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md)); includes **`export_warehouse_topology_graph`** (**BF-50**, setup tier) |
| `/api/wms/billing` | GET | `org.wms` → view |
| `/api/wms/billing` | POST | `org.wms` → edit **or** **`org.wms.operations` → edit** |
| `/api/wms/saved-ledger-views` | GET | `org.wms` → view |
| `/api/wms/saved-ledger-views` | POST | `org.wms` → edit **or** **`org.wms.inventory` → edit** |
| `/api/wms/saved-ledger-views/[id]` | DELETE | `org.wms` → edit **or** **`org.wms.inventory` → edit** |
| `/api/control-tower/timeline` | GET | **`org.controltower` → view** **or** **`org.wms` → view** (**BF-49** — merged CT audits + inventory movements + dock milestones; [`WMS_OPERATIONS_TIMELINE_BF49.md`](./WMS_OPERATIONS_TIMELINE_BF49.md)) |

Implementation: **`requireApiGrant`** for view gates; **`requireAnyApiGrant`** for **`GET /api/control-tower/timeline`** (**BF-49**); **`gateWmsPostMutation`** / **`gateWmsTierMutation`** (`src/lib/wms/wms-mutation-grants.ts`) for mutations.

## UI vs API parity

Pages compute section **`canEdit`** from **`viewerHasWmsSectionMutationEdit`** — matching BF-06 tier gates. Users without any mutation grant still see read-only dashboards where routes allow view-only GETs.

## Audit trail

### Movement-level (always)

Every **`InventoryMovement`** row stores **`createdById`** — full inventory mutations are attributable.

### `CtAuditLog` (selected transitions)

| Trigger area | `action` (representative) |
|--------------|---------------------------|
| Outbound pack / ship | `outbound_mark_packed`, `outbound_mark_shipped` |
| Receiving (Option A) | `wms_receive_transition` |
| VAS / work orders | `work_order_created`, `value_add_task_completed`, `work_order_bom_replaced`, `work_order_bom_line_consumed`, **`work_order_crm_quote_line_linked`**, **`work_order_engineering_bom_synced`** (BF-26) |

Other **`POST`** actions (tasks, holds, waves, dock appointments, etc.) rely on **movement rows + task rows** with **`createdById`** until/unless extended with **`CtAuditLog`** in a later hardening capsule.

## Critical-path verification

Automated inventory: **`src/lib/wms/wms-api-grants.test.ts`** ensures the documented endpoint grant table stays in sync with WE-08 route shells; **`src/lib/wms/wms-mutation-tiers.test.ts`** guards BF-06 action→tier mapping; **`src/lib/wms/wms-inventory-field-acl.test.ts`** guards BF-16 lot-only vs qty-path decisions.
