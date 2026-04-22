# Apply and ingestion lifecycle — operator runbook

**Audience:** operators triaging ingestion runs, apply outcomes, and retries in the **demo tenant** session.  
**Companion:** live HTTP contracts and field notes live in [`README.md`](./README.md) (Apply table + audit paragraph).

## Prerequisites

1. **Active demo session** with a tenant user (see **Settings → Demo session**). Without it, `/apihub` panels stay empty and most `/api/apihub/*` routes return demo-guard responses.
2. Know the **ingestion job id** (`jobId`): UUID of the row in `ApiHubIngestionRun` (shown in **Ingestion runs** on `/apihub` or via `GET /api/apihub/ingestion-jobs`).

## End-to-end apply (live)

1. Confirm the run **`status`** is **`succeeded`** and the linked **connector** is **active** when a connector is attached (otherwise apply returns **409** with a stable `error.code`).
2. **Optional — dry-run first** (see below) to confirm `writeSummary` and `targetSummary` without writing `appliedAt`.
3. `POST /api/apihub/ingestion-jobs/:jobId/apply` with no `dryRun` flag (marker-only), **or** with P3 downstream payload (see next section).
4. **200** body includes `applied: true`, `run` (DTO), and **`targetSummary`** `{ created, updated, skipped }`. With **marker-only** apply, counts prefer JSON on the run’s `resultSummary` when present; otherwise defaults reflect the apply marker. With **downstream** apply, counts and optional **`downstreamSummary`** reflect created SO/PO rows or CT audit rows.

## P3 — downstream apply (SO / PO / Control Tower audit)

Same mapped-row shapes as **staging batch apply**. Requires **`org.orders` → edit** for `sales_order` / `purchase_order` and **`org.controltower` → edit** for `control_tower_audit` (in addition to **`org.apihub` → edit**).

**Body (JSON, optional fields):**

- **`target`:** `sales_order` \| `purchase_order` \| `control_tower_audit`
- **`rows`:** optional array of `{ "rowIndex"?, "mappedRecord" }`. If omitted, the server reads **`rows`** or **`applyRows`** from the run’s **`resultSummary`** string when it is JSON.
- **`matchKey`:** optional `none` (default) or **`sales_order_external_ref`** — rejects when `externalRef` is set and a sales order already exists for the tenant.

**Dry-run** with `target` returns **`writeSummary.downstreamPreview`** when validation passes (row-level dry results).

**409 `APPLY_DOWNSTREAM_FAILED`:** missing/invalid rows, row validation failures, or DB apply errors (message in `error.message`).

**Idempotency:** replays require the same **fingerprint** as the stored row; changing **`target`**, **`matchKey`**, **`rows`** vs **`resultSummary`** source, or marker-only vs downstream returns **409 `APPLY_IDEMPOTENCY_PAYLOAD_MISMATCH`** so clients must use a **new key** when changing apply shape.

## Dry-run (no `appliedAt` write)

- **Query:** `?dryRun=1` (also `true` / `yes`).
- **JSON body:** `{ "dryRun": true }` with `Content-Type: application/json` (can combine with `idempotencyKey` in the same body).
- **200** response: `{ dryRun: true, writeSummary: { wouldApply, wouldSetAppliedAt, targetSummary, gate? }, run }`.  
  If apply would not persist, `gate` explains why (same eligibility rules as live apply). **No 409** in dry-run mode for those cases — the HTTP status stays **200** so scripts get a single envelope.

## Idempotency (safe replay)

- Send **`Idempotency-Key`** header or **`idempotencyKey`** in JSON (header wins; max **128** characters), same pattern as **retry**.
- **First response** is stored per **tenant + key** (including error bodies) with a **`requestFingerprint`**: marker-only apply vs downstream **`target` / `matchKey` / rows source** (body vs `resultSummary`) / normalized **`rows`** payload.
- **Replays** return the **same** status and JSON plus **`idempotentReplay: true`**, when the **same** `jobId`, the **same** `dryRun` flag, and the **same** fingerprint are used.
- **409 `APPLY_IDEMPOTENCY_KEY_CONFLICT`:** the key is already bound to a **different** apply request (different run or dry-run mismatch).
- **409 `APPLY_IDEMPOTENCY_PAYLOAD_MISMATCH`:** the key exists for this run and dry-run mode but the **apply shape changed** (e.g. marker-only → downstream, different `target`, body rows vs `resultSummary`, or `matchKey`). Use a **new** idempotency key.

## Live apply — HTTP conflicts (409)

| `error.code` | Meaning |
|----------------|---------|
| `APPLY_RUN_NOT_SUCCEEDED` | Run is not in `succeeded` status. |
| `APPLY_ALREADY_APPLIED` | `appliedAt` is already set. |
| `APPLY_BLOCKED_CONNECTOR_NOT_FOUND` | Run references a connector id that no longer exists. |
| `APPLY_BLOCKED_CONNECTOR_NOT_ACTIVE` | Connector exists but is not `active`. |
| `APPLY_IDEMPOTENCY_KEY_CONFLICT` | Idempotency key reuse across a different logical apply. |
| `APPLY_IDEMPOTENCY_PAYLOAD_MISMATCH` | Same key + run + dry-run but apply **shape** differs from the stored fingerprint. |
| `APPLY_DOWNSTREAM_FAILED` | P3 downstream apply: unresolved rows, invalid mapped rows, or transactional failure (see response `error.message`). |

**404 `RUN_NOT_FOUND`:** no run for that tenant and id.

**403 `FORBIDDEN`:** downstream `target` requires **`org.orders`** or **`org.controltower`** **`edit`** when not granted.

## Retry (failed runs)

- `POST /api/apihub/ingestion-jobs/:jobId/retry` — only when the run is in a **failed** state (see API errors `RETRY_REQUIRES_FAILED`, `RETRY_LIMIT_REACHED`, `RETRY_IDEMPOTENCY_KEY_CONFLICT` in product behavior).
- Successful retry returns **201** with the **new** run payload; idempotent replay of the same retry key returns **200** with `idempotentReplay: true`.
- **Audit:** every apply and retry response path appends **`ApiHubIngestionRunAuditLog`** (best-effort; failures to write audit do not change the HTTP status).

## Rollback (stub)

- `POST /api/apihub/ingestion-jobs/:jobId/apply/rollback` returns **200** with a **stub** `rollback` object and the current `run` DTO. It does **not** clear `appliedAt` or revert downstream data today — use only to validate routing and future contract.

## Triage in `/apihub`

1. **Alerts** (`#ingestion-alerts`) — summarized **apply** and **retry** client errors from audit (`GET /api/apihub/ingestion-alerts-summary`). Refreshes on demand; hydrated on first load when a demo session exists.
2. **Apply conflicts** (`#apply-conflicts`) — detailed **apply-only** 4xx audit rows (`GET /api/apihub/ingestion-apply-conflicts`) with copy/open-job helpers.
3. **Ingestion runs** — status filters and ops summary for context.

For raw JSON in the browser (with session cookies), open **`GET /api/apihub/ingestion-jobs/:jobId`** in a new tab from the conflicts panel.

## API quick reference

| Goal | Method | Path |
|------|--------|------|
| Live apply | `POST` | `/api/apihub/ingestion-jobs/:jobId/apply` |
| Dry-run apply | `POST` | `…/apply?dryRun=1` or JSON `{ "dryRun": true }` |
| Retry | `POST` | `/api/apihub/ingestion-jobs/:jobId/retry` |
| Rollback stub | `POST` | `/api/apihub/ingestion-jobs/:jobId/apply/rollback` |
| Conflict list | `GET` | `/api/apihub/ingestion-apply-conflicts` |
| Alerts summary | `GET` | `/api/apihub/ingestion-alerts-summary` |

## Support checklist

- [ ] Demo session active and same tenant as data under triage.  
- [ ] Run `status` and `appliedAt` inspected (job JSON or UI).  
- [ ] Dry-run used before first live apply when outcome is uncertain.  
- [ ] Idempotency key chosen per **logical** operation (avoid cross-run reuse).  
- [ ] Alerts / conflicts panels refreshed after reproduction.  
- [ ] If behavior mismatches this doc, update [`README.md`](./README.md) and this runbook in the same docs PR.
