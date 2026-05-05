# RFID commissioning scan bridge — BF-81

**Purpose:** Accept **TID hex**, **GS1 SSCC tag URIs**, and **numeric GTIN** wedge input alongside legacy SKU scans — normalized into BF-29 **multiset** tokens **before** pack/ship validation — without encoder hardware SDKs.

**Authority:** [`BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) §BF-81; multiset verify [**BF-29**](./WMS_PACKING_BF29.md); logistics units [**BF-43**](./WMS_LOGISTICS_UNITS_BF43.md); offline replay [**BF-60**](./WMS_OFFLINE_SCAN_BF60.md).

---

## Schema

| Field | Model | Meaning |
|-------|--------|---------|
| **`wmsRfidEncodingTableJsonBf81`** | **`Tenant`** | Optional encoding table (`schemaVersion` **`bf81.v1`**). |

---

## Encoding table (`bf81.v1`)

| Key | Type | Meaning |
|-----|------|--------|
| **`schemaVersion`** | `"bf81.v1"` | Version guard (unknown versions still clamp maps but may emit parse notice on read). |
| **`enabled`** | boolean | When **false**, TID prefix strip / hex maps are ignored (GTIN digit match vs outbound line **`Product.ean`** and **`urn:epc:id:sscc:`** URIs still apply when scans match those shapes). |
| **`tidHexPrefixStrip`** | string[] | Hex prefixes removed from TID scans **longest first** (e.g. `["E280"]`). |
| **`tidHexToPackToken`** | object | Full TID hex (uppercase, after strip) → pack token (normalized like SKU). |
| **`tidSuffixHexToPackToken`** | object | TID suffix hex → pack token (**longest suffix wins**). |

**Always-on normalization (no tenant JSON required):**

- Plain SKU / product-code wedge → existing **`normalizePackScanToken`**.
- **`urn:epc:id:sscc:…`** → last **18** digits for LU / pallet hooks (**BF-43** **`scanCode`** matching).
- **8–14 digit all-numeric** scans compared to **normalized 14-digit** **`Product.ean`** on the outbound order lines → **`primaryPackScanCode`** for that product.

---

## API

| Surface | Tier | Notes |
|--------|------|------|
| **`set_wms_rfid_encoding_table_bf81`** | setup | Body **`rfidEncodingTableBf81`** JSON object; **`rfidEncodingTableBf81Clear: true`** clears stored JSON. |
| **`GET /api/wms`** | view | **`rfidEncodingBf81`**: `{ schemaVersion, raw, parseNotice, enabled }`. |
| **`validate_outbound_pack_scan`** | operations | Loads tenant table + expands **`packScanTokens`** before multiset verify. |
| **`mark_outbound_packed`** / **`mark_outbound_shipped`** | operations | Same expansion when scan arrays are sent. |
| **`POST /api/wms/scan-events/batch`** (**BF-60**) | operations | Loads tenant table once per batch; pack/ship replay uses same expansion. |

---

## Implementation

- **`expandOutboundPackScanCandidatesBf81`** — [`src/lib/wms/rfid-scan-bridge-bf81.ts`](../../src/lib/wms/rfid-scan-bridge-bf81.ts)
- **`verifyOutboundPackScan`** / **`verifyOutboundPackScanWithLogisticsUnits`** — optional per-scan candidate expansion ([`src/lib/wms/pack-scan-verify.ts`](../../src/lib/wms/pack-scan-verify.ts), [`src/lib/wms/outbound-logistics-unit-scan.ts`](../../src/lib/wms/outbound-logistics-unit-scan.ts))

---

## UI

**Setup → edit:** **RFID commissioning bridge (BF-81)** — JSON textarea + Save / Clear.

---

## Tests

Vitest: [`src/lib/wms/rfid-scan-bridge-bf81.test.ts`](../../src/lib/wms/rfid-scan-bridge-bf81.test.ts).

---

## Out of scope

Printer encode stations, full **EPCIS** binary decode, OEM commissioning hubs.
