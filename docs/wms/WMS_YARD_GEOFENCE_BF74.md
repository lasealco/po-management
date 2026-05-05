# BF-74 — Yard geofence arrival webhook stub

**Scope:** Carrier/telematics-style **arrival pings** that translate into the same **`WmsDockAppointment`** yard timestamps as **`record_dock_appointment_yard_milestone`** / **BF-05**, with **tenant-scoped auth**, optional **HMAC**, mandatory **idempotency**, and **audit** rows (including **BF-54** retrospective **`dock_detention_breach`** when policy applies).

## Endpoint

**`POST /api/wms/yard-geofence-webhook`**

- **Not** session-cookie auth — integration callers only (Bearer secret).
- Returns **`503`** when **`WMS_YARD_GEOFENCE_WEBHOOK_SECRET`** is unset.

## Auth & signing

| Mechanism | Env / header |
|-----------|----------------|
| Bearer | **`Authorization: Bearer <WMS_YARD_GEOFENCE_WEBHOOK_SECRET>`** |
| Optional HMAC (recommended prod) | **`WMS_YARD_GEOFENCE_WEBHOOK_HMAC_SECRET`** set → require **`X-Yard-Geofence-Signature: sha256=<64 lowercase hex>`** over **raw UTF-8 JSON body** (same format as **BF-25** `X-TMS-Signature`). |

## JSON body (`bf74.v1`)

| Field | Required | Notes |
|-------|----------|--------|
| **`dockAppointmentId`** | yes | Target appointment in tenant. |
| **`externalEventId`** | yes | Idempotency key (≤128 chars); **must** be stable across retries. |
| **`yardMilestone`** | yes | **`GATE_IN`** \| **`AT_DOCK`** \| **`DEPARTED`**. |
| **`yardOccurredAt`** | no | ISO datetime; defaults to server **now**. |
| **`tenantSlug`** | no | Defaults **`demo-company`**. |
| **`schemaVersion`** | no | If present, must be **`bf74.v1`**. |

## Behavior

- Appointment must exist and be **`SCHEDULED`** (same family as manual yard milestone + **BF-17** TMS stub).
- **BF-38** guards apply: optional **`WMS_BF38_REQUIRE_DOOR_BEFORE_AT_DOCK`** blocks **`AT_DOCK`** without **`doorCode`**; **`DEPARTED`** requires trailer checklist clear when BF-38 mandates it.
- **`WmsYardGeofenceWebhookReceipt`** stores **`tenantId` + `externalEventId`** — duplicate replay with same appointment → **`{ ok: true, duplicate: true }`** (no double mutation / audit). Different appointment reuse → **409**.
- **`CtAuditLog`** action **`yard_geofence_webhook_bf74`** on **`WMS_DOCK_APPOINTMENT`**; detention breaches still emit **`dock_detention_breach`** (same helper as UI milestone path).

## Env template

See **`docs/wms/tms-webhook.env.example`** (BF-74 section).

## Out of scope

Fleet telematics OEM-specific adapters; automatic appointment matching by trailer/VIN without **`dockAppointmentId`**.

## References

- **`src/app/api/wms/yard-geofence-webhook/route.ts`** — handler.
- **`src/lib/wms/dock-yard-milestone-tx.ts`** — shared milestone + BF-54 side effects.
- **`src/lib/wms/yard-geofence-webhook-bf74.ts`** — payload parse.

_Last updated: 2026-04-29._
