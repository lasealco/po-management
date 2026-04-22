# API Hub — product completion (definition of done v1)

This document ties together what “done” means for the **P2 API Hub** slice: operator flows, permissions, data safety, ops, and honest platform limits. It complements [integrations-ai-assisted-ingestion.md](./integrations-ai-assisted-ingestion.md) and the [apply operator runbook](./apply-operator-runbook.md).

## 1) Happy path (operator)

End-to-end path we ship and test mentally on each release:

1. **Connector** — Create or select a connector; lifecycle reflects readiness ([connectors](./README.md#connectors-registry)).
2. **Run** — Create an ingestion run; observe status in **Ingestion runs** (`/apihub#ingestion-ops`).
3. **Mapping / analysis** — Queue a mapping analysis job; wait for **succeeded**; review proposal (`/apihub#mapping-analysis-jobs`).
4. **Preview** — Use mapping preview / export against a run or rules (`/apihub#mapping-preview-export`).
5. **Promote / apply** — Create a **staging batch** from a succeeded job; **apply** rows to SO / PO / CT targets with optional dry-run (`/apihub#staging-batches`). **Ingestion run apply** (`POST …/ingestion-jobs/:jobId/apply`) can set **`target`** + optional **`rows`** (or use JSON **`resultSummary.rows`**) for the same downstream writes; requires the same module grants as staging apply. See [README](./README.md) apply row and [apply-operator-runbook](./apply-operator-runbook.md).
6. **Clear errors** — Use **Alerts** and **Apply conflicts** (`/apihub#ingestion-alerts`, `/apihub#apply-conflicts`) to triage 4xx outcomes; fix inputs and retry where appropriate.

UI anchors match section `id`s on `/apihub`.

## 2) Permissions (what we sell)

- **Hub access:** `org.apihub` **view** (read routes + hub UI) and **edit** (writes, analysis jobs, staging, templates).
- **Downstream apply:** Staging batch apply to **sales_order** / **purchase_order** requires **`org.orders` → edit**; **control_tower_audit** requires **`org.controltower` → edit** in addition to `org.apihub` edit.
- **Authoritative matrix:** [permissions-matrix.md](./permissions-matrix.md) (parity with `apiHubEnsureTenantActorGrants` and `/apihub` gating).

## 3) Data safety

- **Tenant scoping:** All mutations and lists are scoped to the authenticated demo tenant; patterns are summarized in [TENANT_SCOPING.md](./TENANT_SCOPING.md).
- **No double-apply confusion:** Ingestion-run apply uses idempotency keys and conflict codes (409). Staging batches move **open → promoted** on live apply with **`appliedAt`** / **`applySummary`** set; **discard** is only for batches that were never applied.
- **Staging states:** Documented on staging routes in [README.md](./README.md) (`open`, `promoted`, `discarded`); apply targets are enumerated in code (`APIHUB_STAGING_APPLY_TARGETS`).

## 4) Ops

- **Runbooks:** [RUNBOOK.md](./RUNBOOK.md) (change workflow), [apply-operator-runbook.md](./apply-operator-runbook.md) (apply/retry/idempotency).
- **Release / smoke:** [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — `npm run verify:apihub`, then `npm run smoke:apihub` against the deployed origin.
- **Migrations:** API Hub tables are under `prisma/migrations/` (mapping analysis job, staging batch/row, apply columns, etc.); production must run migrate before code that expects new columns.
- **Environment variables**
  - **`DATABASE_URL`** — required.
  - **OpenAI (optional):** `APIHUB_OPENAI_API_KEY` or `OPENAI_API_KEY`; optional `APIHUB_OPENAI_MODEL` (default `gpt-4o-mini`). Without keys, analysis falls back to the deterministic heuristic engine.
  - **Smoke:** `APIHUB_SMOKE_BASE_URL`, `APIHUB_SMOKE_TIMEOUT_MS` (see release checklist).

## 5) Honest limits

- **JSON request bodies:** Routes use bounded reads via `src/lib/apihub/request-body-limit.ts`.
  - **Default:** **`APIHUB_JSON_BODY_MAX_BYTES`** = **256 KiB** — connectors, ingestion jobs (create/patch/retry), staging batch create/apply, ingestion apply (when `Content-Type` is JSON).
  - **Large:** **`APIHUB_JSON_BODY_MAX_BYTES_LARGE`** = **1 MiB** — mapping analysis jobs, mapping templates (create/patch), mapping diff, mapping preview + export.
  - **Over limit:** **413** `PAYLOAD_TOO_LARGE`. **Invalid JSON** (where routes accept empty body): **400** `INVALID_JSON`, except legacy routes that treat bad JSON as `{}` (still enforced for size before parse).
- **Other caps:** Sample sizes, rule counts, staging row caps, etc., live in `src/lib/apihub/constants.ts` (e.g. `APIHUB_MAPPING_PREVIEW_SAMPLE_MAX`, `APIHUB_STAGING_BATCH_MAX_ROWS`, `APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT`).
- **Workers / `after()`:** Mapping analysis jobs schedule follow-up work with `after()`; long-running work is not guaranteed to complete inside the HTTP request. Operators should poll job status via GET job detail or the hub UI — see spec and README mapping-analysis-jobs section.

---

**Related:** [README.md](./README.md) (full route index), [GAP_MAP.md](./GAP_MAP.md) (spec ↔ code).
