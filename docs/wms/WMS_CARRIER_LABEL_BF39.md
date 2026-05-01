# WMS BF-39 — Production carrier label purchase (minimal slice)

**Scope:** Vendor-neutral **`purchase_carrier_label`** flow: adapter router + **HTTPS JSON** bridge + **`DEMO_PARCEL`** default; **persist** tracking on **`OutboundOrder`**; **`CtAuditLog`** (`outbound_carrier_label_purchased`). **`request_demo_carrier_label`** remains a **non-persisting** synthetic preview.

**Out of scope:** Rate shopping, freight audit, in-repo carrier SDKs.

## Environment variables

| Variable | Required when | Purpose |
|----------|----------------|---------|
| `WMS_CARRIER_LABEL_ADAPTER` | Optional | `demo_parcel` (default) or `http_json`. |
| `WMS_CARRIER_LABEL_HTTP_URL` | `http_json` | HTTPS endpoint for label purchase (`POST` JSON body below). |
| `WMS_CARRIER_LABEL_HTTP_TOKEN` | Optional | If set, sent as `Authorization: Bearer …`. |
| `WMS_CARRIER_LABEL_HTTP_TIMEOUT_MS` | Optional | Request timeout (default `15000`, max `120000`). |
| `NEXT_PUBLIC_WMS_SSCC_COMPANY_PREFIX` | Optional | Same as BF-08/BF-29 — when valid digits, demo SSCC included in label input. |

## HTTP bridge contract

**Request:** `POST` with `Content-Type: application/json`.

```json
{
  "schemaVersion": 1,
  "outboundOrderId": "…",
  "outboundNo": "…",
  "warehouseLabel": "…",
  "barcodePayload": "…",
  "shipToSummary": "…",
  "shipTo": {
    "name": "…",
    "line1": "…",
    "city": "…",
    "countryCode": "…"
  },
  "asnReference": "…",
  "sscc18": "…"
}
```

**Success response (200):** JSON object with:

- `trackingNo` — non-empty string, max 128 characters (stored as **`OutboundOrder.carrierTrackingNo`**).
- `zpl` — string containing ZPL start/end markers **`^XA`** and **`^XZ`**.
- `carrierId` (optional) — short id stored as **`OutboundOrder.carrierLabelAdapterId`** (default `HTTP_JSON` when omitted).

**Errors:** Non-2xx responses may include `{ "error": "message" }` for operator-facing text.

## API actions

- **`purchase_carrier_label`** — `{ "action": "purchase_carrier_label", "outboundOrderId": "…" }`  
  Allowed outbound statuses: **`RELEASED`**, **`PICKING`**, **`PACKED`**. Persists tracking + audit; returns `{ ok, adapterId, trackingNo, zpl, disclaimer? }`.

- **`request_demo_carrier_label`** — always **`DEMO_PARCEL`** preview; does **not** write DB.

## Related docs

- [`WMS_PACKING_BF29.md`](./WMS_PACKING_BF29.md) — pack/ship scan + demo label hook.
- [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) — program capsule context.
