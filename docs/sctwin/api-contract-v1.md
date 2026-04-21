# Supply Chain Twin API Contract v1

This document is the v1 contract freeze reference for Twin APIs in the slices 1-200 program window.
Examples are synthetic and secret-free.

## Scope and conventions

- Base path: `/api/supply-chain-twin`
- Auth/access behavior: routes return `403` when Twin access requirements are not met.
- Tenant safety: cross-tenant entity/scenario/risk ids resolve as `404` where applicable.
- Timestamp format: ISO-8601 strings.
- Error payload shape: `{ "error": "<message>", "code"?: "<STABLE_CODE>" }`

## Endpoint inventory (v1)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/supply-chain-twin/readiness` | Readiness snapshot for Twin availability and data health |
| GET | `/api/supply-chain-twin/metrics` | Aggregate Twin catalog counts and kind breakdown |
| GET | `/api/supply-chain-twin/entities` | List entities with filters/pagination |
| GET | `/api/supply-chain-twin/entities/[id]` | Fetch single entity snapshot by id |
| GET | `/api/supply-chain-twin/entities/[id]/neighbors` | One-hop neighbor query for a selected entity |
| GET | `/api/supply-chain-twin/edges` | List graph edges with scoped filters |
| GET | `/api/supply-chain-twin/events` | List ingest events with filters/pagination |
| POST | `/api/supply-chain-twin/events` | Append ingest event (optional idempotency key) |
| GET | `/api/supply-chain-twin/events/export` | Export events as JSON or CSV with caps |
| GET | `/api/supply-chain-twin/risk-signals` | List risk signals with severity/pagination filters |
| PATCH | `/api/supply-chain-twin/risk-signals/[id]` | Acknowledge/unacknowledge one risk signal |
| GET | `/api/supply-chain-twin/scenarios` | List scenario drafts with pagination |
| POST | `/api/supply-chain-twin/scenarios` | Create scenario draft |
| GET | `/api/supply-chain-twin/scenarios/[id]` | Fetch single scenario draft |
| PATCH | `/api/supply-chain-twin/scenarios/[id]` | Patch scenario title/draft/status |
| DELETE | `/api/supply-chain-twin/scenarios/[id]` | Delete one scenario draft |
| POST | `/api/supply-chain-twin/scenarios/[id]/duplicate` | Duplicate scenario draft |
| GET | `/api/supply-chain-twin/scenarios/[id]/history` | Metadata-only scenario revision history |

## Stable error code table (v1)

Codes below are the frozen v1 set for client handling and operational triage.

| Error code | Meaning | Typical routes |
| --- | --- | --- |
| `QUERY_VALIDATION_FAILED` | Query parameters failed schema/range validation | `GET /entities`, `GET /edges`, `GET /events`, `GET /events/export`, `GET /risk-signals`, `GET /scenarios` |
| `INVALID_CURSOR` | Cursor value is malformed or cannot be decoded | Paginated list endpoints (`entities`, `events`, `risk-signals`, `scenarios`) |
| `FORMAT_INVALID` | Export `format` is not supported (`json` or `csv`) | `GET /events/export` |
| `EXPORT_ROW_CAP_EXCEEDED` | Export result exceeds configured row cap | `GET /events/export` |
| `BODY_JSON_INVALID` | Request body is not valid JSON | Mutating routes (`POST /events`, `POST /scenarios`, `PATCH /scenarios/[id]`, `PATCH /risk-signals/[id]`, `POST /scenarios/[id]/duplicate`) |
| `BODY_VALIDATION_FAILED` | Parsed JSON body fails schema validation | Mutating routes with body payload schemas |
| `INVALID_IDEMPOTENCY_KEY` | `Idempotency-Key` header fails validation | `POST /events` |
| `INVALID_TWIN_INGEST_TYPE` | Ingest event `type` fails writer validation | `POST /events` |
| `TWIN_INGEST_PAYLOAD_TOO_LARGE` | Ingest payload exceeds byte-size cap | `POST /events` |
| `TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE` | Scenario `draft` JSON exceeds byte-size cap | `PATCH /scenarios/[id]` |
| `INVALID_STATUS_TRANSITION` | Scenario status transition is not allowed | `PATCH /scenarios/[id]` |
| `PATH_ID_INVALID` | Path id is missing/blank after normalization | Id-based routes (`/entities/[id]`, `/entities/[id]/neighbors`, `/scenarios/[id]*`, `/risk-signals/[id]`) |

## Notes

- `UNHANDLED_EXCEPTION` appears in structured server logs for triage context and is not a client-contract code.
- Keep future contract updates additive and versioned (e.g., `api-contract-v2.md`) to preserve v1 client compatibility.
