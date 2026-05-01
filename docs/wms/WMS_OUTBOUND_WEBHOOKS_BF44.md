# WMS outbound webhooks (BF-44)

Tenant-configurable HTTPS endpoints that receive signed POST payloads when selected events occur.

## Events

| Event type | Emitted when |
|------------|----------------|
| `RECEIPT_CLOSED` | Receipt closed successfully (`close_wms_receipt`). |
| `OUTBOUND_SHIPPED` | Outbound marked shipped (`mark_outbound_shipped`). |
| `BILLING_EVENT_DISPUTED` | Billing event disputed (`set_billing_event_dispute` with `disputed: true`). |

Only subscriptions that include the event type and are active receive the webhook.

## Setup (UI)

**Warehouse Management → Setup → Outbound webhooks (BF-44)**

- **Endpoint URL** — HTTPS required in production; `http://localhost` / `http://127.0.0.1` allowed for local testing.
- **Signing secret** — Shared secret used for HMAC-SHA256 of the raw JSON body (same header semantics as BF-25 TMS ingest).
- **Events** — Checkboxes per event type.

Creating or updating a subscription replaces list state via POST `api/wms` (`create_wms_outbound_webhook_subscription_bf44`, `update_wms_outbound_webhook_subscription_bf44`, `delete_wms_outbound_webhook_subscription_bf44`). Requires **Setup** tier.

## HTTP delivery

- **Method:** POST  
- **Body:** JSON `{ eventType, tenantSlug, occurredAt, payload }`  
  - Receipt closed / outbound shipped: lightweight identifiers (`receiptId` / `outboundId`, plus codes where applicable).  
  - Billing disputed: `billingEventId`, `movementId`, `billingKind`, `chargeAmount`, `currency`, `periodStart`, `periodEnd`, `invoiceRunId`, `invoiceNumber`, `disputed`, `disputeReason`.
- **Headers:**
  - `Content-Type: application/json`
  - `X-WMS-Webhook-Event` — event type string
  - `X-WMS-Webhook-Delivery-Id` — delivery row id (for correlation)
  - `X-WMS-Webhook-Signature` — `sha256=<hex>` HMAC-SHA256 of the **exact** raw body bytes using UTF-8 signing secret

Verify with the same helper pattern as BF-25 (`verifyTmsWebhookBodySignature`-equivalent: hex digest).

## Delivery rows & retries

Each attempt updates `WmsOutboundWebhookDelivery`: `PENDING` → `DELIVERED` or `FAILED`, plus `attemptCount`, `lastHttpStatus`, `lastError`, `nextAttemptAt`. Failed first attempts use exponential backoff (capped at five minutes in `computeOutboundWebhookBackoffMs`). **Cron retries:** `GET`/`POST` **`/api/cron/wms-outbound-webhook-retries`** with Bearer **`CRON_SECRET`** (see [`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md)); scheduled every five minutes in **`vercel.json`** when deployed.

## Idempotency

`@@unique([subscriptionId, idempotencyKey])` prevents duplicate deliveries for the same logical event (e.g. same receipt close).

## Related

- BF-25 TMS webhook ingest — signing convention alignment  
- BF-45 — partner API surface + webhook retry cron ([`WMS_PARTNER_API_BF45.md`](./WMS_PARTNER_API_BF45.md))
