# WMS BF-40 — Outbound ASN / DESADV export (minimal slice)

**Objective:** Produce a **customer-facing ship-notice** payload as **JSON** (DESADV / ASN-inspired stub), aligned with outbound milestones (**packed** / **shipped**).

**Not in repo:** Certified EDIFACT DESADV or X12 856 segments — this is a **structured JSON template** for ERP/partner mapping.

## Endpoint

**`GET /api/wms/outbound-asn-export`**

- **Auth:** `org.wms` → **view** (same as dashboard reads).
- **Scope:** Respects **`loadWmsViewReadScope`** outbound filters (CRM-linked vs creator-linked orders).
- **Query:**
  - `outboundOrderId` — required.
  - `pretty=1` — pretty-print JSON (optional).

**Response:** `200` with `Content-Type: application/json` and `Content-Disposition: attachment` (`{outboundNo}-desadv-asn.json`).

**Errors:** `400` if outbound is not **PACKED** or **SHIPPED**, or has no lines; `404` if not found or out of scope.

## Payload (`OutboundDesadvSnapshotV1`)

- **`profile`:** `EDIFACT_DESADV_INSPIRED_JSON_STUB_V1` — signals semantics without claiming GS1/UNECE certification.
- **Parties:** dispatching **warehouse**, tenant **supplierOrganization**, **shipTo**, optional CRM **billToCustomer**.
- **Lines:** SKU/code/name, ordered qty, **dispatched** qty — **`PACKED`** basis uses **`packedQty`**; **`SHIPPED`** basis uses **`shippedQty`**.
- **References:** `asnReference`, `customerRef`, optional **`sourceCommercialDocument`** (CRM quote), **`carrierTrackingNo`** when [**BF-39**](./WMS_CARRIER_LABEL_BF39.md) populated.

## UI

WMS **Operations** outbound row: **Export ASN JSON** when status is **PACKED** or **SHIPPED**.

## Forward compatibility

- **BF-44** may add **webhooks** on **`mark_outbound_shipped`** reusing the same snapshot builder.
- Partners map this JSON to **DESADV D96A** / **X12 856** in their integration tier.

## Related

- [**BF-31 … BF-50 mega phases**](./BF31_BF50_MEGA_PHASES.md) — program context.
- [**WMS_PACKING_BF29**](./WMS_PACKING_BF29.md) — pack/ship scan discipline before ship notice.
