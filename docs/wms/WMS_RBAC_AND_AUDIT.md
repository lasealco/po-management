# WMS RBAC and audit (WE-08)

## Enterprise stance vs blueprint field matrix

Blueprint references a granular **`wms_role_permission_matrix`**. This repo does **not** implement per-field ACLs on WMS entities.

**Chosen alternative (Phase A–B):**

| Layer | Mechanism |
|-------|-----------|
| **Coarse HTTP auth** | Global grants **`org.wms` → `view`** / **`edit`** on every **`/api/wms/**`** handler |
| **Server UI gate** | **`WmsGate`** (`src/app/wms/wms-gate.tsx`) requires **`org.wms` → `view`** before rendering any `/wms/**` shell |
| **Read scoping** | **`loadWmsViewReadScope`** narrows inbound shipments, outbound orders, CRM-linked payloads, product division filters — consistent with PO/CRM/Control Tower |
| **Mutations** | **`POST /api/wms`** requires **`org.wms` → `edit`**; interactive surfaces pass **`canEdit`** from **`viewerHas(..., "edit")`** |
| **CRM outbound link** | **`assertOutboundCrmAccountLinkable`** enforces **`org.crm` → view** + CRM list scope |
| **Evidence** | **`InventoryMovement.createdById`** on posted quantities; **`CtAuditLog`** on selected transitions (below) |

Future **field-level** enforcement belongs in a dedicated RBAC epic with schema + middleware — out of scope for WE-08.

## HTTP enforcement inventory

Aligned with **`src/lib/wms/wms-api-grants.ts`** (Vitest guard).

| Surface | Method | Grant |
|---------|--------|-------|
| `/api/wms` | GET | `org.wms` → view |
| `/api/wms` | POST | `org.wms` → edit |
| `/api/wms/billing` | GET | `org.wms` → view |
| `/api/wms/billing` | POST | `org.wms` → edit |
| `/api/wms/saved-ledger-views` | GET | `org.wms` → view |
| `/api/wms/saved-ledger-views` | POST | `org.wms` → edit |
| `/api/wms/saved-ledger-views/[id]` | DELETE | `org.wms` → edit |

Implementation: **`requireApiGrant`** in each route module (`src/app/api/wms/**/route.ts`).

## UI vs API parity

Pages compute **`canEdit`** from **`viewerHas(grantSet, "org.wms", "edit")`** — matching **`POST`** gates. Users without edit still see read-only dashboards where routes allow view-only GETs.

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

Automated inventory: **`src/lib/wms/wms-api-grants.test.ts`** ensures the documented endpoint grant table stays in sync with WE-08 expectations.
