# Receiving line variance — BF-01

**Status:** Implemented (thin Option **B**-style fields on existing `ShipmentItem`, not a separate receipt header table).

**References:** [`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md) § Options A/B · [`GAP_MAP.md`](./GAP_MAP.md) inbound ASN row · [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md) **BF-01**.

## Model

| Field | Purpose |
|-------|---------|
| `ShipmentItem.quantityShipped` | Expected qty on the ASN/shipment line (existing). |
| `ShipmentItem.quantityReceived` | Physical count recorded at receiving (existing; **editable** via API/UI). |
| `ShipmentItem.wmsVarianceDisposition` | `UNSET` \| `MATCH` \| `SHORT` \| `OVER` \| `DAMAGED` \| `OTHER` — updated with each save. |
| `ShipmentItem.wmsVarianceNote` | Optional operator note (≤1000 chars). |

**Disposition:** **`Auto`** in UI sends no explicit disposition; server derives Match / Short / Over vs `quantityShipped` using `src/lib/wms/receive-line-variance.ts` (`RECEIVE_LINE_QTY_EPSILON`). Operators may force **Damaged** / **Other** or override Match/Short/Over.

## API

- **`POST /api/wms`** — `action: "set_shipment_item_receive_line"`  
  Body: `shipmentItemId`, `receivedQty` (number ≥ 0), optional `varianceDisposition`, optional `varianceNote` (omit to leave note unchanged; empty string clears).

## Audit

`CtAuditLog`: `entityType: "SHIPMENT_ITEM"`, `action: "inbound_receive_line_updated"`, `shipmentId` set.

## Deferred

Full **`WmsReceipt` header + multi-event receipts**, tolerance policies per SKU, and ERP disposition workflows remain backlog unless product funds a follow-on capsule.
