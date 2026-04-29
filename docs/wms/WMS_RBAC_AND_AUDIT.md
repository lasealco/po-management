# WMS RBAC and audit (WE-08)

## Enterprise stance vs blueprint field matrix

Blueprint references a granular **`wms_role_permission_matrix`**. This repo does **not** implement per-field ACLs on WMS entities.

**BF-06 (2026-04-29):** Three **scoped mutation tiers** — **`org.wms.setup`**, **`org.wms.operations`**, **`org.wms.inventory`** — each with **view / edit**, layered on legacy **`org.wms` → `edit`**. See [`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md).

**Chosen alternative (Phase A–B):**

| Layer | Mechanism |
|-------|-----------|
| **Coarse HTTP auth** | Global grants **`org.wms` → `view`** / **`edit`** on **`/api/wms`** GET; **`POST`** actions gated by tier map **or** legacy **`org.wms` → `edit`** ([`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md)). Nested routes: **`/api/wms/billing`** POST → **operations** tier; **`/api/wms/saved-ledger-views`** POST/DELETE → **inventory** tier. |
| **Server UI gate** | **`WmsGate`** (`src/app/wms/wms-gate.tsx`) requires **`org.wms` → `view`** before rendering any `/wms/**` shell |
| **Read scoping** | **`loadWmsViewReadScope`** narrows inbound shipments, outbound orders, CRM-linked payloads, product division filters — consistent with PO/CRM/Control Tower |
| **Mutations** | Section-aware **`canEdit`** from **`viewerHasWmsSectionMutationEdit`** (Setup / Operations / Stock / Billing billing shell uses **operations** tier); interactive surfaces match tier gates |
| **CRM outbound link** | **`assertOutboundCrmAccountLinkable`** enforces **`org.crm` → view** + CRM list scope |
| **Evidence** | **`InventoryMovement.createdById`** on posted quantities; **`CtAuditLog`** on selected transitions (below) |

Future **field-level** enforcement belongs in a dedicated RBAC epic with schema + middleware — optional tightening beyond BF-06 tier split.

## HTTP enforcement inventory

Aligned with **`src/lib/wms/wms-api-grants.ts`** (Vitest guard).

| Surface | Method | Grant |
|---------|--------|-------|
| `/api/wms` | GET | `org.wms` → view |
| `/api/wms` | POST | **`org.wms` → edit** **or** scoped **`org.wms.{setup|operations|inventory}` → edit** per `action` ([`WMS_RBAC_BF06.md`](./WMS_RBAC_BF06.md)) |
| `/api/wms/billing` | GET | `org.wms` → view |
| `/api/wms/billing` | POST | `org.wms` → edit **or** **`org.wms.operations` → edit** |
| `/api/wms/saved-ledger-views` | GET | `org.wms` → view |
| `/api/wms/saved-ledger-views` | POST | `org.wms` → edit **or** **`org.wms.inventory` → edit** |
| `/api/wms/saved-ledger-views/[id]` | DELETE | `org.wms` → edit **or** **`org.wms.inventory` → edit** |

Implementation: **`requireApiGrant`** for view gates; **`gateWmsPostMutation`** / **`gateWmsTierMutation`** (`src/lib/wms/wms-mutation-grants.ts`) for mutations.

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
| VAS / work orders | `work_order_created`, `value_add_task_completed` |

Other **`POST`** actions (tasks, holds, waves, dock appointments, etc.) rely on **movement rows + task rows** with **`createdById`** until/unless extended with **`CtAuditLog`** in a later hardening capsule.

## Critical-path verification

Automated inventory: **`src/lib/wms/wms-api-grants.test.ts`** ensures the documented endpoint grant table stays in sync with WE-08 route shells; **`src/lib/wms/wms-mutation-tiers.test.ts`** guards BF-06 action→tier mapping.
