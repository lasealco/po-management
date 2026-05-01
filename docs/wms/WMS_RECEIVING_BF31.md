# Receiving — BF-31 (GRN & ASN qty tolerance)

**Purpose:** Extend **BF-12 / BF-21** dock receipts with **finance-facing GRN references** on **`WmsReceipt`** and optional **ASN quantity tolerance** (**`Shipment.asnQtyTolerancePct`**) so operators can **evaluate** line deltas vs shipped qty, optionally **block receipt close**, or **gate “Receipt complete”** advancement until tolerance passes — without carrier ASN hubs or ERP GL posting.

**Authority:** [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) §BF-31; coexists with [`WMS_RECEIVING_BF21.md`](./WMS_RECEIVING_BF21.md).

---

## Schema

| Field | Model | Meaning |
|-------|--------|---------|
| **`asnQtyTolerancePct`** | **`Shipment`** | Optional **0–100**: max allowed **absolute %-delta** per line between **`quantityReceived`** and **`quantityShipped`** when tolerance policy is applied. |
| **`grnReference`** | **`WmsReceipt`** | Optional **GRN** string (≤128) stored when an **OPEN** receipt is **closed**. |

---

## API (`POST /api/wms`)

| Action | Notes |
|--------|--------|
| **`set_shipment_inbound_fields`** | Optional **`asnQtyTolerancePct`** (`number` or **`null`** to clear). Combine with **`asnReference`** / **`expectedReceiveAt`** as today. |
| **`evaluate_wms_receipt_asn_tolerance`** | **`shipmentId`** → **`{ withinTolerance, tolerancePct, policyApplied, lines[] }`** using current **`ShipmentItem`** quantities vs **`asnQtyTolerancePct`**. Read-only. |
| **`close_wms_receipt`** | Optional **`grnReference`** or **`generateGrn: true`** (**`GRN-YYYYMMDD-*`**). Optional **`requireWithinAsnToleranceForAdvance`** with **`receiptCompleteOnClose`**: only advance receiving status when tolerance passes (if tolerance configured). Optional **`blockCloseIfOutsideTolerance`**: **400** if tolerance configured and violated. Response adds **`grnReference`**, **`withinAsnTolerance`**, **`receiveStatusSkippedDueToTolerance`**. |

## Pure helpers & tests

| Artifact | Role |
|----------|------|
| **`src/lib/wms/asn-receipt-tolerance.ts`** | **`evaluateShipmentReceiveAgainstAsnTolerance`**, **`generateDockGrnReference`**. |
| **`src/lib/wms/asn-receipt-tolerance.test.ts`** | Vitest coverage. |

## UI

Operations **Inbound / receiving**: **ASN tol %** column (saved with **Save**), dock receipt close panel — **GRN**, **Generate GRN**, tolerance gate checkboxes, closed receipt history shows **GRN** when present.

---

## Explicit backlog (not BF-31)

Carrier ASN **855** ingestion, auto-close from external ASN payloads, GRN numbering service with issuer registry. **BF-32** covers **receiving accrual staging** snapshots + CSV export ([`WMS_RECEIVING_BF32.md`](./WMS_RECEIVING_BF32.md)); ERP GL posting automation remains backlog.

_Last updated: 2026-05-08 — BF-31 minimal slice shipped; BF-32 receiving accrual staging landed separately._
