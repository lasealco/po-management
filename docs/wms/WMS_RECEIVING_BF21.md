# Receiving — BF-21 (receipt accounting slice)

**Purpose:** Minimal **BF-21** bridge between **BF-12** dock receipt sessions and finance-ready receiving workflows: **closed receipt visibility**, **idempotent close**, and an **optional ASN/receiving-state advance** when a session closes — without ERP GL posting.

**Authority:** [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-21; coexists with [`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md) Option A + **BF-12** Option B.

---

## What landed (BF-21)

| Capability | Behavior |
|------------|----------|
| **Closed receipt history** | `GET /api/wms` inbound shipments include **`closedWmsReceiptHistory`** (up to **12** newest **`CLOSED`** `WmsReceipt` rows per shipment): id, **closedAt**, **closedBy**, line count, dock metadata. **`openWmsReceipt`** unchanged (single OPEN session). |
| **Idempotent close** | `close_wms_receipt` on an already **`CLOSED`** receipt returns **`{ ok: true, alreadyClosed: true }`** (HTTP 200), not 400. |
| **Optional “Receipt complete” on close** | Request body **`receiptCompleteOnClose: true`**. After closing the OPEN receipt, if **`Shipment.wmsReceiveStatus`** allows transition to **`RECEIPT_COMPLETE`** (typically from **`RECEIVING`**; **`DISCREPANCY`** also allowed per state machine), apply transition + **`CtAuditLog`** `wms_receive_transition` with **`source: "close_wms_receipt"`**. Response includes **`receiveStatusAdvanced`** boolean. If the transition is not legal, close still succeeds; **`receiveStatusAdvanced`** is **`false`**. |
| **Pure helper** | `canAdvanceReceiveStatusToReceiptComplete` in **`src/lib/wms/wms-receipt-close-policy.ts`** (Vitest). |

## Explicit backlog (not BF-21)

- ASN **auto-close** rules tied to carrier ASN payloads (855/JSON), tolerance policies per SKU beyond **BF-31** dock %-tol guardrails, centralized **`GRN`** numbering service, accrual stubs, receipt **versioning** beyond audit logs.

---

_Last updated: 2026-05-03 — BF-21 minimal slice shipped._
