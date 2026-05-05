# WMS partner REST API (BF-45 + BF-98)

Machine-to-machine endpoints for 3PL / ERP integrations, authenticated with **tenant API keys** (no browser session). **BF-45** delivered scoped **reads**; **BF-98** adds one scoped **write** (inbound ASN advise upsert) behind an explicit scope.

## Issuing keys

**Warehouse Management → Setup → Partner API keys (BF-45)**

- Requires **Setup** tier (`POST /api/wms`): `create_wms_partner_api_key_bf45`, `revoke_wms_partner_api_key_bf45`.
- Body: optional `partnerApiKeyLabel`, required non-empty `partnerApiKeyScopes` (subset of `INVENTORY_READ`, `OUTBOUND_READ`, `INBOUND_ASN_ADVISE_WRITE`).
- Response includes **`apiKeyPlaintext`** once — store it securely; only a **SHA-256 hash** and **`keyPrefix`** are persisted.

## Authentication

Send either:

- `Authorization: Bearer <apiKeyPlaintext>`, or  
- `X-WMS-Partner-Key: <apiKeyPlaintext>`

Keys are opaque strings starting with `wmsp_live_`.

## Endpoints (v1)

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| `GET` | `/api/wms/partner/v1/inventory-balances?warehouseId=<uuid>` | `INVENTORY_READ` | Warehouse-scoped balance rows (SKU, bin, lot bucket, qty, hold). Optional `limit` (1–2000, default 500). |
| `GET` | `/api/wms/partner/v1/outbound-orders/<outboundOrderId>` | `OUTBOUND_READ` | Outbound header + lines with qty snapshots. |
| `POST` | `/api/wms/partner/v1/mutations/inbound-asn-advise` | `INBOUND_ASN_ADVISE_WRITE` | Upsert inbound ASN advise by **`externalAsnId`** (same validation path as internal advise). Response **`schemaVersion`: `bf98.v1`**. |

Successful JSON responses include `schemaVersion`, `tenantSlug`, and resource payload (GET uses numeric **`schemaVersion`** for reads; BF-98 mutation responses use string **`bf98.v1`**). Errors use the shared API error shape (`error`, `code`) for **401**/**403**; mutation validation and FK failures return **`partnerV1Json`** with **`ok`**, **`schemaVersion`**, and **`code`** (including **400**, **404**, **503**).

### BF-98 mutation actor and audit

Partner callers have no browser session. Writes use the **first active tenant `User` by `createdAt`** as **`actorUserId`** / **`createdById`** surrogate so existing rows and **`CtAuditLog`** stay consistent. If the tenant has **no** active user, the mutation returns **503** (`SERVICE_UNAVAILABLE`). Each successful upsert writes **`CtAuditLog`** with action **`bf98_partner_inbound_asn_advise_upsert`**; **`payload.partnerApiKeyId`** identifies the key; **`actorUserId`** is the surrogate user (not the key id).

## Rate limiting

Responses include advisory headers **`X-RateLimit-Limit`**, **`X-RateLimit-Remaining`**, **`X-RateLimit-Policy: stub-no-enforcement`** — enforcement is backlog.

## OpenAPI

See [`openapi-partner-v1.yaml`](./openapi-partner-v1.yaml).

## Webhook retries (BF-44 overlap)

Failed outbound webhook deliveries (`nextAttemptAt` set) are retried by cron:

- **`GET`** or **`POST`** `/api/cron/wms-outbound-webhook-retries`  
- **`Authorization: Bearer <CRON_SECRET>`** (same as other app crons)  
- Optional query **`limit`** (1–100, default 25)

Scheduled in root **`vercel.json`** every five minutes when deployed on Vercel.

## Related

- BF-98 scoped mutation pilot — this doc (`POST …/mutations/inbound-asn-advise`, `INBOUND_ASN_ADVISE_WRITE`).  
- BF-44 outbound webhooks — [`WMS_OUTBOUND_WEBHOOKS_BF44.md`](./WMS_OUTBOUND_WEBHOOKS_BF44.md)  
- BF-25 TMS inbound signing — shared `sha256=<hex>` convention for webhooks
