# Supply Chain Twin Permission and Visibility Matrix (v1 Lock)

This document locks the permission and visibility behavior for Twin routes to the current live API guards.

## Canonical guard chain (applies to all `/api/supply-chain-twin/*`)

Twin routes call `requireTwinApiAccess()` and enforce this order:

1. Demo acting user must exist (`user != null`).
2. Twin module entitlement must be enabled for tenant.
3. Actor must not be supplier-portal-restricted.
4. Session nav visibility must include `supplyChainTwin`.

If any check fails, route returns `403` with stable guard copy.

## Stable guard-deny semantics (`403`)

- `TWIN_API_ERROR_NO_DEMO_USER`: no active demo user selected for session.
- `TWIN_API_ERROR_MODULE_DISABLED`: Twin disabled by env entitlement gate (`SCTWIN_FORCE_DISABLE`, `SCTWIN_DISABLED_TENANT_SLUGS`).
- `TWIN_API_ERROR_SUPPLIER_PORTAL_FORBIDDEN`: supplier-portal-restricted actors cannot use Twin APIs.
- `TWIN_API_ERROR_VISIBILITY_FORBIDDEN`: session/nav visibility does not grant Twin access.

## Action semantics (v1)

- `view`: read-only Twin catalog/readiness/list/detail access.
- `edit`: mutating operations that create/update/delete Twin business data.
- `export`: read-only data extraction operation (download/large response path).
- `admin`: operational integrity-repair mutation requiring explicit confirmation.

## Route/action matrix (locked)

| Method | Route | Action semantic | Notes |
| --- | --- | --- | --- |
| GET | `/api/supply-chain-twin/readiness` | `view` | Availability + data-health snapshot |
| GET | `/api/supply-chain-twin/metrics` | `view` | Catalog aggregate counters |
| GET | `/api/supply-chain-twin/entities` | `view` | Entity list/search |
| GET | `/api/supply-chain-twin/entities/[id]` | `view` | Entity detail |
| GET | `/api/supply-chain-twin/entities/[id]/neighbors` | `view` | Graph neighborhood for entity |
| GET | `/api/supply-chain-twin/edges` | `view` | Edge list/filter |
| GET | `/api/supply-chain-twin/events` | `view` | Ingest timeline list |
| GET | `/api/supply-chain-twin/events/export` | `export` | Export path with row-cap validation |
| GET | `/api/supply-chain-twin/risk-signals` | `view` | Risk signal list |
| GET | `/api/supply-chain-twin/scenarios` | `view` | Scenario list |
| GET | `/api/supply-chain-twin/scenarios/[id]` | `view` | Scenario draft detail |
| GET | `/api/supply-chain-twin/scenarios/[id]/history` | `view` | Scenario revision history |
| GET | `/api/supply-chain-twin/integrity` | `view` | Read-only integrity summary |
| GET | `/api/supply-chain-twin/integrity/repair-dry-run` | `view` | Read-only repair proposals |
| POST | `/api/supply-chain-twin/events` | `edit` | Append ingest event (idempotency enforced) |
| PATCH | `/api/supply-chain-twin/risk-signals/[id]` | `edit` | Acknowledge/unacknowledge risk signal |
| POST | `/api/supply-chain-twin/scenarios` | `edit` | Create scenario draft |
| PATCH | `/api/supply-chain-twin/scenarios/[id]` | `edit` | Patch scenario draft/state |
| DELETE | `/api/supply-chain-twin/scenarios/[id]` | `edit` | Delete scenario draft |
| POST | `/api/supply-chain-twin/scenarios/[id]/duplicate` | `edit` | Duplicate scenario draft |
| POST | `/api/supply-chain-twin/integrity/repair-apply` | `admin` | Mutating integrity repair (`confirmApply=true` required) |

## Operator guidance

- Treat `admin` operations as controlled maintenance steps and capture audit outputs.
- Keep UI affordances aligned to these semantics:
  - show `view` and `export` actions when Twin API gate allows access,
  - disable/hide `edit` and `admin` actions for workflows that should remain read-only.
- When adding new Twin routes, update this matrix in the same PR to avoid permission drift.
