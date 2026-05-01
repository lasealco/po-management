# QA sampling & disposition templates — BF-42

**Purpose:** Tenant-defined **receiving variance note templates** plus optional **QA sampling hints** on **`ShipmentItem`** rows — lightweight QA scaffolding without a full LIMS.

**Authority:** [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) §BF-42; complements [**BF-01**](./WMS_RECEIVING_LINE_VARIANCE_BF01.md) variance notes.

---

## Schema

| Field | Model | Meaning |
|-------|--------|---------|
| **`code`** (unique per tenant), **`title`**, **`noteTemplate`** | **`WmsReceivingDispositionTemplate`** | Template body supports tokens below. |
| **`suggestedVarianceDisposition`** | **`WmsReceivingDispositionTemplate`** | Optional UI hint (`MATCH` … `OTHER`); **not** auto-applied to BF-01 disposition. |
| **`wmsQaSamplingSkipLot`** | **`ShipmentItem`** | Skip-lot style flag (informational). |
| **`wmsQaSamplingPct`** | **`ShipmentItem`** | Optional **0–100** sample-inspect percentage vs shipped qty. |
| **`wmsReceivingDispositionTemplateId`** | **`ShipmentItem`** | Optional default template for **Apply template**. |

---

## Note template tokens

Substituted by **`apply_wms_disposition_template_to_shipment_item`** (output truncated to **1000** chars for **`wmsVarianceNote`**):

| Token | Source |
|-------|--------|
| `{{lineNo}}` | PO line number |
| `{{qtyShipped}}` | Shipped qty on line |
| `{{qtyReceived}}` | Received qty on line |
| `{{productSku}}` | Product **`sku`** or **`productCode`** |
| `{{asnReference}}` | **`Shipment.asnReference`** |
| `{{orderNumber}}` | **`PurchaseOrder.orderNumber`** |

Pure helper: **`substituteReceivingDispositionNoteTemplate`** — [`src/lib/wms/receiving-disposition-template.ts`](../../src/lib/wms/receiving-disposition-template.ts).

---

## API (`POST /api/wms`)

| Action | Tier | Notes |
|--------|------|------|
| **`create_wms_receiving_disposition_template`** | setup | **`receivingDispositionTemplateCode`**, **`receivingDispositionTemplateTitle`**, **`receivingDispositionNoteTemplate`**; optional **`receivingDispositionTemplateSuggestedVarianceDisposition`**. Aliases: **`templateCode`**, **`templateTitle`**, **`noteTemplate`**. |
| **`update_wms_receiving_disposition_template`** | setup | **`receivingDispositionTemplateId`** + patch fields. |
| **`delete_wms_receiving_disposition_template`** | setup | **`receivingDispositionTemplateId`**. |
| **`set_shipment_item_qa_sampling_bf42`** | operations | **`shipmentItemId`** + optional **`wmsQaSamplingSkipLot`**, **`wmsQaSamplingPct`** (`null` clears), **`wmsReceivingDispositionTemplateId`** (`null` clears via disconnect). |
| **`apply_wms_disposition_template_to_shipment_item`** | operations | **`shipmentItemId`**; optional **`receivingDispositionTemplateId`** override — else uses line default FK. Updates **`wmsVarianceNote`** + **`CtAuditLog`** (`bf42_disposition_template_applied`). |

**`GET /api/wms`** adds **`receivingDispositionTemplates`** and BF-42 fields on **`inboundShipments[].receiveLines[]`** (including **`productSku`**).

---

## UI

- **Setup:** **Receiving QA templates (BF-42)** — list, create, edit, delete.
- **Operations — Inbound / ASN:** per-line **QA (BF-42)** column — skip-lot, sample **%**, template select, **Save QA**, **Apply template**.

---

## Explicit backlog (not BF-42)

Full LIMS, regulated pharma validation package, automated AQL tables, enforced sampling gates on receipt close.
