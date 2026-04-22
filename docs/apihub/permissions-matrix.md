# API Hub — permissions matrix (Slice 51 + 52 baseline)

This document matches **current route handlers** under `src/app/api/apihub/**` (**28** `route.ts` files as of 2026-04-22: one public health route + 27 guarded). **Slice 52 (shipped):** handlers use `apiHubEnsureTenantActorGrants` → **`org.apihub`** `view` or `edit` via `userHasGlobalGrant` (demo tenant + demo actor unchanged). Staging **apply** additionally requires **`org.orders`** or **`org.controltower`** `edit` per target.

**Payload bounds:** JSON POST/PATCH bodies are size-capped server-side (`APIHUB_JSON_BODY_MAX_BYTES` / `_LARGE` in `src/lib/apihub/constants.ts`); oversize requests return **413** `PAYLOAD_TOO_LARGE`. See [product-completion-v1.md](./product-completion-v1.md).

## Legend

| Term | Meaning in code |
|------|------------------|
| **Public** | No `getDemoTenant()` / `getActorUserId()` in the handler; safe for unauthenticated discovery. |
| **Demo tenant + actor** | Handler calls `getDemoTenant()` and `getActorUserId()` from `@/lib/demo-tenant` / `@/lib/authz`. Data is scoped to the resolved **demo tenant**; the **actor** is the active demo-session user (`getDemoActorEmail()` → `User` row for that tenant). |
| **`org.apihub` + module grants** | Non-health routes use **`apiHubEnsureTenantActorGrants`**; **`POST …/staging-batches/:id/apply`** and **`POST …/ingestion-jobs/:jobId/apply`** (when JSON **`target`** is `sales_order` / `purchase_order` / `control_tower_audit`) enforce **`org.orders`** / **`org.controltower`** **`edit`** per [README](./README.md). |

## Failure responses (demo tenant + actor)

When a guarded handler runs:

| Condition | HTTP | Code (body) | Typical message |
|-----------|------|---------------|-----------------|
| Demo tenant missing / not seeded | **404** | `TENANT_NOT_FOUND` | Run `npm run db:seed` … |
| No active demo actor for session | **403** | `ACTOR_NOT_FOUND` | Open Settings → Demo session … |
| JSON body over API Hub size cap | **413** | `PAYLOAD_TOO_LARGE` | Body exceeds `APIHUB_JSON_BODY_MAX_BYTES` (256 KiB) or `_LARGE` (1 MiB) — see [product-completion-v1.md](./product-completion-v1.md). |

Most guarded POST/PATCH routes parse JSON with `emptyOnInvalid: true` (legacy behavior): **malformed JSON is treated as an empty object**, not **400** `INVALID_JSON`. The shared parser still enforces the byte cap before parse.

Helpers: `apiHubDemoTenantMissing`, `apiHubDemoActorMissing` in `src/lib/apihub/api-error.ts`.

## Public routes

| Method | Path | Guards |
|--------|------|--------|
| `GET` | `/api/apihub/health` | **Public** — returns JSON from `getApiHubHealthJson()`; no session or tenant resolution. |

## Demo tenant + actor + grants (all other API Hub HTTP handlers)

Every other `route.ts` under `src/app/api/apihub/` resolves **demo tenant + actor**, then checks **`org.apihub`** (and module grants where applicable).

| Method(s) | Path | Purpose (short) |
|-----------|------|------------------|
| `GET`, `POST` | `/api/apihub/connectors` | List / create connectors |
| `PATCH` | `/api/apihub/connectors/:connectorId` | Update connector |
| `GET` | `/api/apihub/connectors/:connectorId/audit` | Connector audit log |
| `GET` | `/api/apihub/connectors/:connectorId/health` | Connector health read |
| `GET`, `POST` | `/api/apihub/ingestion-jobs` | List / create ingestion jobs |
| `GET` | `/api/apihub/ingestion-jobs/ops-summary` | Ops summary |
| `GET`, `PATCH` | `/api/apihub/ingestion-jobs/:jobId` | Job detail / update |
| `GET` | `/api/apihub/ingestion-jobs/:jobId/timeline` | Timeline |
| `POST` | `/api/apihub/ingestion-jobs/:jobId/retry` | Retry |
| `POST` | `/api/apihub/ingestion-jobs/:jobId/mapping-preview` | Mapping preview |
| `POST` | `/api/apihub/ingestion-jobs/:jobId/mapping-preview/export` | Preview export |
| `POST` | `/api/apihub/ingestion-jobs/:jobId/apply` | Apply: marker-only **or** P3 downstream (`target` + optional `rows` / `resultSummary.rows`; module grants when `target` set) |
| `POST` | `/api/apihub/ingestion-jobs/:jobId/apply/rollback` | Rollback stub |
| `GET` | `/api/apihub/ingestion-apply-conflicts` | Apply conflict list |
| `GET` | `/api/apihub/ingestion-alerts-summary` | Alerts summary |
| `GET`, `POST` | `/api/apihub/mapping-templates` | List / create templates |
| `GET`, `PATCH`, `DELETE` | `/api/apihub/mapping-templates/:templateId` | Template CRUD |
| `GET` | `/api/apihub/mapping-templates/:templateId/audit` | Template audit |
| `POST` | `/api/apihub/mapping-diff` | Rule diff |
| `POST` | `/api/apihub/import-assistant/chat` | Import assistant chat turn (bounded JSON; **`org.apihub` → view**) |
| `GET`, `POST` | `/api/apihub/mapping-analysis-jobs` | List / queue mapping analysis job (P2) |
| `GET` | `/api/apihub/mapping-analysis-jobs/:jobId` | Job detail + proposal |
| `POST` | `/api/apihub/mapping-analysis-jobs/:jobId/process` | Manually claim/process a queued job (dev / retry) |
| `GET`, `POST` | `/api/apihub/staging-batches` | List / create staging batch from analysis job |
| `GET` | `/api/apihub/staging-batches/:batchId` | Batch + rows |
| `POST` | `/api/apihub/staging-batches/:batchId/apply` | Downstream apply (SO/PO/CT); extra grants |
| `POST` | `/api/apihub/staging-batches/:batchId/discard` | Discard open batch |

## App UI (`/apihub`)

| Surface | Gate | Notes |
|---------|------|--------|
| `/apihub` (layout content) | `ApihubGate` in `src/app/apihub/apihub-gate.tsx` | Uses `getViewerGrantSet()`; requires signed-in user + **`org.apihub` → view**. Page SSR uses **`org.apihub` → edit** for mutations (templates, connectors, analysis, staging, etc.) and module grants for **staging** and **ingestion** downstream apply targets (SO/PO/CT). |

## Code pointers

- Guard helpers: `getDemoTenant`, `getActorUserId`, `getViewerGrantSet` — `src/lib/demo-tenant.ts`, `src/lib/authz.ts`.
- Machine-readable summary: `src/lib/apihub/apihub-access-model.ts`.

## Maintainer rule

When adding or changing a handler under `src/app/api/apihub/**`, update this matrix (and `README.md` endpoint tables if the contract is user-facing) in the same change set when practical.
