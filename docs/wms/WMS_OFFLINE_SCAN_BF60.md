# BF-60 — Mobile offline scan batch replay

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-60; builds on **BF-29** [`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md) pack/ship multiset validation.

## Landed behavior

| Surface | Detail |
|--------|--------|
| **Model** | **`WmsScanEventBatch`** — `tenantId`, unique **`(tenantId, clientBatchId)`**, **`deviceClock`**, **`createdById`**, **`lastStatusCode`** (200 or 409), **`lastResponseJson`** (full replay body). |
| **POST** | **`/api/wms/scan-events/batch`** — JSON: **`clientBatchId`**, **`deviceClock`**, **`events[]`** with contiguous **`seq`** from 1, per-event **`deviceClock`**, **`type`** (`VALIDATE_PACK_SCAN` \| `VALIDATE_SHIP_SCAN`), **`payload.outboundOrderId`**, and **`packScanTokens`** / **`shipScanTokens`** arrays. **`org.wms` → view** + **`gateWmsTierMutation(..., "operations")`**. |
| **Idempotency** | Same **`clientBatchId`** returns the **cached** **`lastResponseJson`** with the original status (200 or 409). |
| **409 conflict** | **`{ ok: false, code: "SCAN_BATCH_CONFLICT", batchId?, failedAtSeq, conflict: { kind, message, outboundOrderId, orderStatus?, missing?, unexpected?, luErrors? } }`** — see mega-phase doc. |
| **UI** | **`/wms`** Operations **Outbound & ship station** — BF-60 JSON panel + **`scanEventBatches`** on **`GET /api/wms`**. |

### Event kinds

- **`VALIDATE_PACK_SCAN`** — Same gates as **`validate_outbound_pack_scan`** (order **RELEASED** / **PICKING** / **PACKED**); BF-43 LU-aware multiset rules; **BF-81** tenant RFID encoding expansion when configured.
- **`VALIDATE_SHIP_SCAN`** — Same gates as ship scan before **`mark_outbound_shipped`** (order **PACKED**, fully packed, optional **`WMS_ENFORCE_SSCC`**, optional **`WMS_REQUIRE_SHIP_SCAN`** empty-token rule); **BF-81** expansion when configured.

## Out of scope

Full PWA service worker, IndexedDB sync, CRDT inventory merges.

_Last updated: 2026-05-05 — BF-81 RFID expansion on replay._
