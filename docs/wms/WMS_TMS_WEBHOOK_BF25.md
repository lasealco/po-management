# BF-25 — Production TMS webhook hardening (minimal shipped)

**Capsule:** carrier-facing webhook improvements beyond **BF-17** Bearer stub — see [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-25, dock reference [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md).

## What shipped

| Piece | Detail |
|-------|--------|
| **HMAC body signing** | Optional env **`TMS_WEBHOOK_HMAC_SECRET`**. When set, **`POST /api/wms/tms-webhook`** requires header **`X-TMS-Signature: sha256=<64-char lowercase hex>`** over the **raw JSON body bytes** (UTF-8). Bearer **`TMS_WEBHOOK_SECRET`** remains required. |
| **Idempotency** | Optional JSON **`externalEventId`** (≤128 chars). Persisted in **`WmsTmsWebhookReceipt`** with **`@@unique([tenantId, externalEventId])`**. Duplicate delivery with the **same** `dockAppointmentId` returns **`{ ok: true, duplicate: true }`** and **does not** mutate the appointment or append another audit for that mutation. Reuse of the same key for a **different** appointment → **409**. |
| **Audit** | Successful mutations still log **`CtAuditLog`** **`tms_webhook_stub`**; payload includes **`externalEventId`** (when sent) and **`hmacEnforced`**. |
| **Tests** | Vitest extensions in **`tms-webhook-stub.test.ts`**. |

## Integration checklist

1. Issue **`TMS_WEBHOOK_SECRET`** per environment; rotate on compromise.
2. Prefer a **distinct** **`TMS_WEBHOOK_HMAC_SECRET`** (may equal Bearer secret only for demos).
3. Middleware/TMS must send **byte-stable JSON** for HMAC (no pretty-print drift vs signing step).
4. Supply **`externalEventId`** from the carrier message id / GUID when available so retries are safe.
5. **`tenantSlug`** continues to route tenants (defaults **`demo-company`**).
6. Monitor **401** (Bearer/HMAC), **409** (idempotency misuse), **503** (secret unset).

## Explicit backlog

- Signed JWT / mTLS, multi-region ingress routing, DLQ replay UI.
- Carrier certification artifacts per vendor.
- Rate shopping / freight audit (**BF-25 out of scope**).

## References

- **`docs/wms/tms-webhook.env.example`** — env template.
- **`src/app/api/wms/tms-webhook/route.ts`** — handler.

_Last updated: 2026-05-05._
