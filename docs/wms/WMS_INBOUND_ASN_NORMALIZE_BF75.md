# Inbound ASN normalize stub (BF-75 minimal)

**Authority:** [`BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) §BF-75; lands on **BF-59** [`WMS_INBOUND_ASN_ADVISE_BF59.md`](./WMS_INBOUND_ASN_ADVISE_BF59.md).

## Landed behavior

| Surface | Detail |
|--------|--------|
| **Model** | **`WmsInboundAsnAdvise.asnPartnerId`** — optional `VARCHAR(128)` logical partner / carrier id from normalize (indexed with `tenantId`). |
| **Lib** | **`normalizeInboundAsnEnvelopeBf75`** (`src/lib/wms/inbound-asn-normalize-bf75.ts`) — **`partnerId`** + **`rawEnvelope`**; optional **`envelopeHint`** (`bf59_wrap` \| `compact_items_v1`) or auto-detect; emits **`bf75.v1`** with normalized **`lines`** via **`parseInboundAsnAdviseLines`**. |
| **Upsert** | **`upsertInboundAsnAdviseRow`** (`src/lib/wms/inbound-asn-advise-upsert.ts`) — shared FK checks + upsert for BF-59 POST and BF-75 persist; **`asnPartnerId`** omitted from JSON body leaves the column unchanged on update. |
| **POST** | **`/api/wms/inbound-asn-normalize`** — **`partnerId`**, **`rawEnvelope`**, optional **`envelopeHint`**, **`persist`** (default **`true`**), optional **`warehouseId`** / **`purchaseOrderId`** / **`shipmentId`**. Same **`org.wms` → view** + **`operations`** tier gate as inbound-asn-advise. **`persist: false`** returns **`{ ok, normalized }`** only. |
| **UI** | **`/wms`** Operations **Inbound / ASN** — BF-75 panel calls **`POST /api/wms/inbound-asn-normalize`**; recent advises table shows **`asnPartnerId`**. |

## Out of scope

In-process X12 **856** / EDIFACT DESADV translators, VAN routing, and automatic **`ShipmentItem`** qty marry-up from advises.

_Last updated: 2026-04-29 — BF-75 minimal stub._
