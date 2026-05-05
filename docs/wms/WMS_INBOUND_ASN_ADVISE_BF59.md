# Inbound ASN pre-advise (BF-59 minimal)

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-59; complements **BF-31** ASN tolerance at receipt and inbound **Shipment** / **ShipmentItem** truth.

## Landed behavior

| Surface | Detail |
|--------|--------|
| **Model** | **`WmsInboundAsnAdvise`** — `tenantId` + unique **`externalAsnId`**; optional **`asnPartnerId`** (BF-75); optional `warehouseId`, `purchaseOrderId`, `shipmentId`; `asnReference`, `expectedReceiveAt`; **`linesJson`** (normalized array); optional **`rawPayloadJson`**. |
| **POST** | **`/api/wms/inbound-asn-advise`** — JSON body: **`externalAsnId`** (required), **`lines`** (array, ≥1 line with positive **`quantityExpected`**), optional **`asnPartnerId`** (omit on upsert to leave existing value unchanged), optional **`warehouseId`**, **`purchaseOrderId`**, **`shipmentId`**, **`asnReference`**, **`expectedReceiveAt`**, **`rawPayload`**. **Upsert** on `(tenantId, externalAsnId)`. **`org.wms` → view** + **`org.wms.operations` → edit** (or legacy **`org.wms` → edit**). |
| **GET** | Same path — **`limit`** (default 40, max 200); **`org.wms` → view**. |
| **UI** | **`/wms`** Operations **Inbound / ASN** — BF-59 panel + BF-75 normalize panel + recent advise table; payload includes **`inboundAsnAdvises`** (**`asnPartnerId`**) on **`GET /api/wms`**. Partner envelope normalize: **`POST /api/wms/inbound-asn-normalize`** — [`WMS_INBOUND_ASN_NORMALIZE_BF75.md`](./WMS_INBOUND_ASN_NORMALIZE_BF75.md). |

### Line shape (normalized)

Each element of **`lines`** may include: **`lineNo`** (int ≥ 0), **`productSku`** / **`productCode`**, **`quantityExpected`** (or aliases **`qty`**, **`expectedQty`**), **`uom`**, **`lotCode`**.

## Out of scope

X12 **856** / EDIFACT DESADV certify, VAN, automatic **`ShipmentItem.quantityShipped`** overwrite from advise (future marry-up).

_Last updated: 2026-04-29 — BF-59 minimal stub + **BF-75** partner id + normalize cross-ref._
