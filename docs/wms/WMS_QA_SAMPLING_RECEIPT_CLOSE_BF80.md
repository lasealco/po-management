# QA sampling enforcement on receipt close — BF-80

**Purpose:** When **BF-42** ties an inbound line to a disposition template **and** requests non–skip-lot sampling (`wmsQaSamplingPct` **> 0**), **`close_wms_receipt`** can refuse to close until operators record **variance documentation** on the shipment line and/or the dock receipt line — a lightweight gate without LIMS.

**Authority:** [`BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) §BF-80; builds on [`WMS_QA_SAMPLING_BF42.md`](./WMS_QA_SAMPLING_BF42.md), [`WMS_RECEIVING_BF31.md`](./WMS_RECEIVING_BF31.md) close-flag patterns.

---

## Policy (evaluate helper)

**Demands QA documentation** when all hold:

- `ShipmentItem.wmsReceivingDispositionTemplateId` is set  
- `ShipmentItem.wmsQaSamplingSkipLot` is **false**  
- `ShipmentItem.wmsQaSamplingPct` parses to a number **> 0** (and ≤ 100)

**Complete** when **either** non-empty trimmed **`ShipmentItem.wmsVarianceNote`** **or** **`WmsReceiptLine.wmsVarianceNote`** exists for that shipment item (dock receipt line keyed by `shipmentItemId`). Applying the disposition template (`apply_wms_disposition_template_to_shipment_item`) typically satisfies the shipment-line note path.

Pure helper: **`evaluateWmsReceiptQaSamplingBf80`** — [`src/lib/wms/qa-sampling-receipt-bf80.ts`](../../src/lib/wms/qa-sampling-receipt-bf80.ts).

---

## API (`POST /api/wms`)

| Surface | Notes |
|--------|--------|
| **`close_wms_receipt`** | Optional **`blockCloseIfQaSamplingIncompleteBf80`** (boolean). When **true** and the helper reports **`policyApplied`** but not **`complete`**, respond **400** with **`code`: `WMS_BF80_QA_SAMPLING_INCOMPLETE`** and **`incompleteShipmentItemIds`** in JSON **`extra`**. |
| Close audit payload | **`qaSamplingBf80PolicyApplied`**, **`qaSamplingBf80Complete`** on `wms_receipt_closed`. |
| Success JSON | **`qaSamplingBf80PolicyApplied`**, **`qaSamplingBf80Complete`** echoed for observability. |

**Out of scope:** LIMS / instrument feeds, automated AQL tables (same as BF-42 backlog).

---

## UI

**Operations — Inbound:** dock receipt close cluster includes **BF-80 — block close if QA sampling notes incomplete** (on by default); uncheck to bypass the gate when integrating legacy flows.

---

## Tests

Vitest: [`src/lib/wms/qa-sampling-receipt-bf80.test.ts`](../../src/lib/wms/qa-sampling-receipt-bf80.test.ts).
