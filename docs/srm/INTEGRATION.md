# SRM — integration API (Phase E)

Operator-facing notes for **inbound supplier upsert** and **outbound export**. All routes are **tenant-scoped** via the same session / demo-actor model as the rest of the app (`getDemoTenant()`).

## Authentication and grants

- Uses the **same browser session / API session** as other app routes (not a separate API key in MVP).
- **`POST /api/srm/integrations/v1/suppliers/upsert`** requires **`org.suppliers` → `edit`** (same as creating or editing suppliers in the UI).
- Changing **activation** or **approval status** in the payload requires **`org.suppliers` → `approve`** (same as `PATCH /api/suppliers/[id]`).
- **`GET /api/srm/integrations/v1/suppliers/export`** requires **`org.suppliers` → `view`**.

## Rate limits

- No separate product rate limiter in MVP. Requests are bounded by the **Next.js route body size** check on upsert (**256 KB** max JSON).
- Idempotency rows are stored in PostgreSQL (`SrmIntegrationIdempotency`); very high churn may require a future retention policy.

## Error envelope

Responses follow the shared helper shape where applicable:

```json
{ "error": "Human-readable message.", "code": "MACHINE_CODE" }
```

Common codes:

| HTTP | `code` | When |
|------|--------|------|
| 400 | `BAD_INPUT` | Invalid JSON, schema, or field validation |
| 403 | `FORBIDDEN` | Missing grant (e.g. approval change without approve) |
| 404 | `NOT_FOUND` | `match.id` does not exist in tenant |
| 409 | `CONFLICT` | Unique constraint (e.g. duplicate `code`) |
| 409 | `IDEMPOTENCY_CONFLICT` | Same `Idempotency-Key` reused with a **different** body hash |

Successful upsert:

```json
{
  "ok": true,
  "schema": "srm_supplier_upsert_v1",
  "mode": "created" | "updated",
  "supplier": { "...": "..." }
}
```

## Inbound — `srm_supplier_upsert_v1`

**`POST /api/srm/integrations/v1/suppliers/upsert`**

- **`schemaVersion`**: must be **`1`**.
- **`match`** (optional):
  - **`{ "id": "<cuid>" }`** — update that supplier; `supplier` must contain at least one valid field (same rules as `PATCH /api/suppliers/[id]`).
  - **`{ "code": "ACME" }`** — upsert by **tenant-unique** `code`: update if found, otherwise create (default name `Partner <code>` if `supplier.name` omitted).
- **No `match`** — create a new supplier; **`supplier.name`** is required (same as `POST /api/suppliers`).
- **`supplier`** — object whose fields align with **`PATCH /api/suppliers/[id]`** for updates and **`POST /api/suppliers`** for creates (see route handlers for full validation).

### Idempotency

- Optional header **`Idempotency-Key`** (max **256** characters).
- Body is hashed (stable JSON) with **SHA-256**; the first **2xx** response is stored per tenant + key + route surface.
- Retries with the **same** key and **same** body receive the stored response with header **`X-Idempotent-Replay: true`**.
- Same key with a **different** body → **`409`** with `IDEMPOTENCY_CONFLICT`.

### Example — create (curl)

```bash
curl -sS -X POST "$ORIGIN/api/srm/integrations/v1/suppliers/upsert" \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "schemaVersion": 1,
    "supplier": {
      "name": "Example Vendor",
      "code": "EX-001",
      "srmCategory": "product",
      "email": "ap@example.com"
    }
  }'
```

### Example — upsert by code

```bash
curl -sS -X POST "$ORIGIN/api/srm/integrations/v1/suppliers/upsert" \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "schemaVersion": 1,
    "match": { "code": "EX-001" },
    "supplier": { "phone": "+1-555-0100" }
  }'
```

## Outbound — export

**`GET /api/srm/integrations/v1/suppliers/export`**

| Query | Values |
|-------|--------|
| `format` | `json` (default) or `csv` |
| `kind` | `product`, `logistics`, or omit for **all** |

- **JSON:** `{ "schemaVersion": 1, "kind": "...", "suppliers": [ ... ] }`
- **CSV:** `Content-Disposition: attachment` with columns: `id`, `name`, `code`, `email`, `phone`, `isActive`, `srmCategory`, `approvalStatus`, `updatedAt`.

```bash
curl -sS -H "Cookie: <session-cookie>" \
  "$ORIGIN/api/srm/integrations/v1/suppliers/export?format=csv&kind=product" \
  -o suppliers.csv
```

## Outbound — analytics snapshot (Phase J)

**`GET /api/srm/integrations/v1/analytics/snapshot`**

- **Grants:** **`org.suppliers` → `view`**. **Order and booking** blocks use the same rules as the in-app **SRM analytics** API (orders metrics require **`org.orders` → `view`**; booking SLA is only for `kind=logistics`).

| Query | Values |
|-------|--------|
| `from` | Optional `YYYY-MM-DD` (UTC) — same default window as **SRM · Analytics** |
| `to` | Optional `YYYY-MM-DD` (UTC) |
| `kind` | `product` (default) or `logistics` |

- **JSON** envelope:

```json
{
  "schemaVersion": 1,
  "kind": "srm_analytics_snapshot_v1",
  "generatedAt": "2026-04-23T12:00:00.000Z",
  "from": "...",
  "to": "...",
  "supplierKind": "product",
  "orderKpi": { },
  "orderMetricsRequiresOrdersView": false,
  "bookingSla": null,
  "operationalSignals": {
    "suppliersInScope": 0,
    "byApprovalStatus": { "pending_approval": 0, "approved": 0, "rejected": 0 },
    "onboardingTasksOpen": 0,
    "onboardingTasksOverdue": 0
  }
}
```

`operationalSignals` is a **point-in-time** snapshot (approval mix + onboarding backlog) for the selected supplier **kind**; it is not filtered by the `from`/`to` order window. Pair with **`GET /api/srm/analytics`** for the same body shape under `/api/srm/integrations/...` (with `schemaVersion` / `kind` / `generatedAt` on the integration route only).

## Database

- Apply migrations through your normal pipeline so **`SrmIntegrationIdempotency`** exists before relying on idempotency in production.
