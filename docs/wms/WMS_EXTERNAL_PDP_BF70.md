# BF-70 — External PDP authorization hooks

**Scope:** Optional **HTTP policy decision point** after **`org.wms` → view** and **`gateWmsPostMutation`** (BF-06 / BF-16 / BF-48), before **`handleWmsPost`** runs. When disabled (no env URL), **all** eligible mutations behave as today.

## Environment

| Variable | Purpose |
|----------|---------|
| **`WMS_EXTERNAL_PDP_URL`** | When non-empty, **POST** this URL for each **`POST /api/wms`** with JSON body **`bf70.v1`**. When empty/unset, PDP is **skipped** (allow). |
| **`WMS_EXTERNAL_PDP_TIMEOUT_MS`** | Optional; default **3000**, clamped **100–30000**. |
| **`WMS_EXTERNAL_PDP_FAIL_OPEN`** | When **`1`**, **`true`**, or **`yes`** (case-insensitive): network/timeout/unparseable PDP success responses **allow** the mutation instead of returning **503**. **`allow: false`** from PDP still denies. |

The **URL itself is not** exposed on **`GET /api/wms`**; operators see only **`externalPdpBf70.enabled`**, **`timeoutMs`**, and **`failOpen`**.

## Request contract (server → PDP)

`POST` with `Content-Type: application/json`:

```json
{
  "schemaVersion": "bf70.v1",
  "tenantId": "<tenant id>",
  "actorUserId": "<user id>",
  "action": "<wms post action string>",
  "body": { "...": "sanitized post body" }
}
```

- **`body`** is a **redacted** shallow copy: keys matching **`secret` / `password` / `token` / `signing` / `authorization` / `credential` / `apikey`** (case-insensitive) are **dropped**; strings truncated; nested values JSON-serialized with size caps.

## Response contract (PDP → server)

**HTTP 200** with JSON object:

- **`{ "allow": true }`** — proceed to handler.
- **`{ "allow": false, "reason": "..." }`** — **`403`** to client; **`reason`** optional (default message if missing).

Any other shape, non-JSON body, non-2xx HTTP, timeout, or connect error: **`503`** with a short message, unless **`WMS_EXTERNAL_PDP_FAIL_OPEN`** is enabled.

Error JSON may include **`externalPdpBf70: true`** and **`schemaVersion: "bf70.v1"`** in **`extra`** for clients.

## Implementation

- [`src/lib/wms/external-pdp-bf70.ts`](../../src/lib/wms/external-pdp-bf70.ts) — **`evaluateExternalWmsPolicy`**, **`sanitizeWmsBodyForExternalPdp`**, **`externalPdpBf70DashboardMeta`**
- [`src/app/api/wms/route.ts`](../../src/app/api/wms/route.ts) — POST hook
- [`src/lib/wms/get-wms-payload.ts`](../../src/lib/wms/get-wms-payload.ts) — **`externalPdpBf70`** on dashboard JSON
- Vitest: [`src/lib/wms/external-pdp-bf70.test.ts`](../../src/lib/wms/external-pdp-bf70.test.ts) (local **`http.Server`** mock)

## Out of scope

Full **Open Policy Agent** sidecars, mTLS to tenant VPC-only PDPs, federated trust registries.
