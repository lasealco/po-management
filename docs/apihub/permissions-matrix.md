# API Hub — permissions matrix (Slice 51)

This document matches **current route handlers** under `src/app/api/apihub/**`. It is the baseline for **Slice 52** (fine-grained `org.apihub.*` grants on APIs) and **Slice 53** (UI gating).

## Legend

| Term | Meaning in code |
|------|------------------|
| **Public** | No `getDemoTenant()` / `getActorUserId()` in the handler; safe for unauthenticated discovery. |
| **Demo tenant + actor** | Handler calls `getDemoTenant()` and `getActorUserId()` from `@/lib/demo-tenant` / `@/lib/authz`. Data is scoped to the resolved **demo tenant**; the **actor** is the active demo-session user (`getDemoActorEmail()` → `User` row for that tenant). |
| **RBAC (future)** | No `org.apihub.*` (or similar) checks exist on these routes today; Slice 52 will align checks with the permission catalog. |

## Failure responses (demo tenant + actor)

When a guarded handler runs:

| Condition | HTTP | Code (body) | Typical message |
|-----------|------|---------------|-----------------|
| Demo tenant missing / not seeded | **404** | `TENANT_NOT_FOUND` | Run `npm run db:seed` … |
| No active demo actor for session | **403** | `ACTOR_NOT_FOUND` | Open Settings → Demo session … |

Helpers: `apiHubDemoTenantMissing`, `apiHubDemoActorMissing` in `src/lib/apihub/api-error.ts`.

## Public routes

| Method | Path | Guards |
|--------|------|--------|
| `GET` | `/api/apihub/health` | **Public** — returns JSON from `getApiHubHealthJson()`; no session or tenant resolution. |

## Demo tenant + actor (all other API Hub HTTP handlers)

Every other `route.ts` under `src/app/api/apihub/` uses **demo tenant + actor** before business logic.

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
| `POST` | `/api/apihub/ingestion-jobs/:jobId/apply` | Apply (incl. dry-run / idempotency) |
| `POST` | `/api/apihub/ingestion-jobs/:jobId/apply/rollback` | Rollback stub |
| `GET` | `/api/apihub/ingestion-apply-conflicts` | Apply conflict list |
| `GET` | `/api/apihub/ingestion-alerts-summary` | Alerts summary |
| `GET`, `POST` | `/api/apihub/mapping-templates` | List / create templates |
| `GET`, `PATCH`, `DELETE` | `/api/apihub/mapping-templates/:templateId` | Template CRUD |
| `GET` | `/api/apihub/mapping-templates/:templateId/audit` | Template audit |
| `POST` | `/api/apihub/mapping-diff` | Rule diff |

## App UI (`/apihub`)

| Surface | Gate | Notes |
|---------|------|--------|
| `/apihub` (layout content) | `ApihubGate` in `src/app/apihub/apihub-gate.tsx` | Uses `getViewerGrantSet()`; blocks when `!access?.user` (same demo-actor resolution as APIs: tenant + demo email → user). Copy points to **Settings → Demo session** (`/settings/demo`). |
| **RBAC (future)** | — | `grantSet` is loaded but not used for API Hub–specific hides yet (Slice 53). |

## Code pointers

- Guard helpers: `getDemoTenant`, `getActorUserId`, `getViewerGrantSet` — `src/lib/demo-tenant.ts`, `src/lib/authz.ts`.
- Machine-readable summary: `src/lib/apihub/apihub-access-model.ts`.

## Maintainer rule

When adding or changing a handler under `src/app/api/apihub/**`, update this matrix (and `README.md` endpoint tables if the contract is user-facing) in the same change set when practical.
