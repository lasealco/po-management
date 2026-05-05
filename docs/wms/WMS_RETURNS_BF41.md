# Returns & RMA receiving — BF-41

**Purpose:** First-class **customer returns** on inbound PO shipments: **`CUSTOMER_RETURN`** subtype, **RMA** reference, optional link to a **source outbound** order, and **per-line disposition** (**RESTOCK** / **SCRAP** / **QUARANTINE**) that ties receiving and putaway to existing hold semantics (**BF-02**).

**Authority:** [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) §BF-41; stacks on [`WMS_RECEIVING_LINE_VARIANCE_BF01.md`](./WMS_RECEIVING_LINE_VARIANCE_BF01.md), [`WMS_LOT_BATCH_BF02.md`](./WMS_LOT_BATCH_BF02.md) (holds).

---

## Schema

| Field | Model | Meaning |
|-------|--------|---------|
| **`wmsInboundSubtype`** | **`Shipment`** | **`STANDARD`** (default PO receipt) or **`CUSTOMER_RETURN`**. |
| **`wmsRmaReference`** | **`Shipment`** | Optional RMA / authorization string (trimmed, capped server-side). Cleared when subtype returns to **`STANDARD`**. |
| **`returnSourceOutboundOrderId`** | **`Shipment`** | Optional FK to **`OutboundOrder`** for lineage; cleared when subtype is **`STANDARD`**. |
| **`wmsReturnDisposition`** | **`ShipmentItem`** | **`RESTOCK`**, **`SCRAP`**, or **`QUARANTINE`** when shipment subtype is **`CUSTOMER_RETURN`**. |

---

## Policy (pure helpers)

| Artifact | Role |
|----------|------|
| **`src/lib/wms/customer-return-policy.ts`** | **`customerReturnPutawayBlockedReason`** (**SCRAP** blocks putaway); **`customerReturnApplyQuarantineHold`** (**QUARANTINE** sets balance on hold after putaway). |
| **`src/lib/wms/customer-return-policy.test.ts`** | Vitest coverage. |

**Putaway handlers** (`create_putaway_task`, `complete_putaway_task`) load subtype + line disposition and enforce the above.

---

## API (`POST /api/wms`)

| Action | Notes |
|--------|------|
| **`set_shipment_inbound_fields`** | Optional **`wmsInboundSubtype`**, **`wmsRmaReference`**, **`returnSourceOutboundOrderId`** (tenant **`OutboundOrder`** id or **`null`**). Setting subtype to **`STANDARD`** clears RMA + outbound link server-side. |
| **`set_shipment_item_return_disposition`** | **`shipmentItemId`** + **`wmsReturnDisposition`** — only when parent shipment **`wmsInboundSubtype`** is **`CUSTOMER_RETURN`**; writes **`CtAuditLog`** (`customer_return_line_disposition_set`). |
| **`apply_rma_disposition_rules_bf85`** | **`shipmentId`**, optional **`wmsRmaDispositionRulesOverwriteBf85`** — bulk-applies tenant **BF-85** rules; see [`WMS_RMA_DISPOSITION_RULES_BF85.md`](./WMS_RMA_DISPOSITION_RULES_BF85.md). |

**`GET /api/wms`** payload includes **`wmsInboundSubtype`**, **`wmsRmaReference`**, **`returnSourceOutboundOrderId`**, embedded **`returnSourceOutbound`** `{ id, outboundNo }`, and each **`receiveLines[].wmsReturnDisposition`**, plus **`rmaDispositionRulesBf85`** (ordered BF-85 setup rows).

---

## UI

Operations **Inbound / ASN**: **Inbound type**, **RMA**, **Src outbound** columns; tag filter **Customer returns only**; line grid **Return disp.** with **Save line** chaining **`set_shipment_item_return_disposition`** then existing receipt / receive-line POST.

---

## Explicit backlog (not BF-41)

Refund orchestration, marketplace multi-channel returns, automated RMA issuance.
