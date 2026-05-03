# BF-65 — Damage workflow & carrier claim export (minimal)

**Purpose:** Structured **damage reports** at **receiving** or **packing** with **photo URLs** and a **carrier-facing JSON** export — no carrier API filing.

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-65; complements **BF-41** line dispositions (damage narrative is separate from `wmsReturnDisposition`).

---

## Schema

| Field | Model | Meaning |
|-------|--------|---------|
| **`WmsDamageReport`** | (new) | Tenant-scoped row: **`context`** `RECEIVING` \| `PACKING`, **`status`** `DRAFT` \| `SUBMITTED`, optional **`shipmentId`** / **`outboundOrderId`** / **`shipmentItemId`**, **`damageCategory`**, **`description`**, **`photoUrlsJson`**, **`extraDetailJson`**, **`carrierClaimReference`**. |

**RECEIVING** requires **`shipmentId`** (inbound **`Shipment`** for tenant). **PACKING** requires **`outboundOrderId`**. Optional **`shipmentItemId`** only for receiving lines on that shipment.

---

## API

| Endpoint / action | Notes |
|-------------------|--------|
| **`POST /api/wms`** **`action`: `create_wms_damage_report_bf65`** | **`damageReportContext`**, **`damageReportStatus`** (optional, default `DRAFT`), **`damageCategory`**, **`damageDescription`**, **`damagePhotoUrls`** (array or string), **`damageExtraDetailJson`**, **`carrierClaimReference`**, plus **`shipmentId`** / **`outboundOrderId`** / **`shipmentItemId`** per rules above. **`org.wms.operations`** (or legacy **`org.wms`** edit). |
| **`GET /api/wms/damage-reports/[id]/claim-export`** | **`schemaVersion`** `bf65.v1` — report envelope, optional inbound / outbound summaries, **`claimNarrative`** text. Respects WMS read scope (same as other `GET /api/wms` payloads). |

**Audits:** **`CtAuditLog`** **`wms_damage_report_created_bf65`** (`entityType` **`WMS_DAMAGE_REPORT`**).

---

## Limits (server)

- Photo URLs: max **12**, each max **2048** chars, scheme **`http`/`https`** or **relative** `/…`.
- Description max **4000** chars; category max **128**; claim ref max **256**; **`extraDetailJson`** serialize max **8192** bytes.

---

## UI

Operations **Create / edit outbound** area: **BF-65** panel — context, ids, narrative, photos, **Create damage report**; table links to **claim export** JSON.

---

## Out of scope

Carrier claim **API** submission, auto-generated PDF packets, legal evidence chain-of-custody.
