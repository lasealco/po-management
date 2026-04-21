# Apply and ingestion lifecycle — operator runbook

**Audience:** operators triaging ingestion runs, apply outcomes, and retries in the **demo tenant** session.  
**Companion:** live HTTP contracts and field notes live in [`README.md`](./README.md) (Apply table + audit paragraph).

## Prerequisites

1. **Active demo session** with a tenant user (see **Settings → Demo session**). Without it, `/apihub` panels stay empty and most `/api/apihub/*` routes return demo-guard responses.
2. Know the **ingestion job id** (`jobId`): UUID of the row in `ApiHubIngestionRun` (shown in **Ingestion runs** on `/apihub` or via `GET /api/apihub/ingestion-jobs`).

## End-to-end apply (live)

1. Confirm the run **`status`** is **`succeeded`** and the linked **connector** is **active** when a connector is attached (otherwise apply returns **409** with a stable `error.code`).
2. **Optional — dry-run first** (see below) to confirm `writeSummary` and `targetSummary` without writing `appliedAt`.
3. `POST /api/apihub/ingestion-jobs/:jobId/apply` with no `dryRun` flag.
4. **200** body includes `applied: true`, `run` (DTO), and **`targetSummary`** `{ created, updated, skipped }`. Counts prefer JSON on the run’s `resultSummary` when present; otherwise defaults reflect the apply marker only until downstream wiring emits real counts.

## Dry-run (no `appliedAt` write)

- **Query:** `?dryRun=1` (also `true` / `yes`).
- **JSON body:** `{ "dryRun": true }` with `Content-Type: application/json` (can combine with `idempotencyKey` in the same body).
- **200** response: `{ dryRun: true, writeSummary: { wouldApply, wouldSetAppliedAt, targetSummary, gate? }, run }`.  
  If apply would not persist, `gate` explains why (same eligibility rules as live apply). **No 409** in dry-run mode for those cases — the HTTP status stays **200** so scripts get a single envelope.

## Idempotency (safe replay)

- Send **`Idempotency-Key`** header or **`idempotencyKey`** in JSON (header wins; max **128** characters), same pattern as **retry**.
- **First response** is stored per **tenant + key** (including error bodies). **Replays** return the **same** status and JSON plus **`idempotentReplay: true`**, when the **same** `jobId` **and** the **same** `dryRun` flag are used.
- **409 `APPLY_IDEMPOTENCY_KEY_CONFLICT`:** the key is already bound to a **different** apply request (different run or dry-run mismatch).

## Live apply — HTTP conflicts (409)

| `error.code` | Meaning |
|----------------|---------|
| `APPLY_RUN_NOT_SUCCEEDED` | Run is not in `succeeded` status. |
| `APPLY_ALREADY_APPLIED` | `appliedAt` is already set. |
| `APPLY_BLOCKED_CONNECTOR_NOT_FOUND` | Run references a connector id that no longer exists. |
| `APPLY_BLOCKED_CONNECTOR_NOT_ACTIVE` | Connector exists but is not `active`. |
| `APPLY_IDEMPOTENCY_KEY_CONFLICT` | Idempotency key reuse across a different logical apply. |

**404 `RUN_NOT_FOUND`:** no run for that tenant and id.

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
