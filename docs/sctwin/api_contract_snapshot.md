# Supply Chain Twin API Contract Snapshot (Current)

This page is a lightweight OpenAPI-style reference for the currently implemented Supply Chain Twin endpoints.
All examples are synthetic and secret-free.

## Conventions
- **Base path:** `/api/supply-chain-twin`
- **Auth gate:** Twin APIs return `403` when session/user/access requirements are not met.
- **Common errors:** `{ "error": "<message>" }`, with optional stable `code` on selected validation failures.
- **Timestamps:** ISO-8601 strings.

## Readiness and Metrics

### `GET /readiness`
- **200**: `{ ok, reasons[], healthIndex, hasTwinData }`
- **Example:**
```json
{
  "ok": true,
  "reasons": [],
  "healthIndex": {
    "mode": "stub",
    "score": 72,
    "disclaimer": "non_production"
  },
  "hasTwinData": true
}
```

### `GET /metrics`
- **200**: entity/edge/event/scenario/risk counts plus `entityCountsByKind` and `generatedAt`.

## Entities and Edges

### `GET /entities`
- **Query:** `q`, `limit`, `cursor`, `fields=summary|full`, `entityKind`
- **200**: `{ items[], nextCursor? }`

### `GET /entities/{id}`
- **200**: `{ id, ref, createdAt, updatedAt, payload }`
- **404**: not found or cross-tenant id.

### `GET /entities/{id}/neighbors`
- **Query:** `direction=in|out|both`, `take`
- **200**: `{ id, neighbors[] }`

### `GET /edges`
- **Query:** graph/neighbor filters (validated combinations), `take`
- **200**: `{ edges[] }`

## Ingest Events

### `GET /events`
- **Query:** `limit`, `cursor`, `type` (or legacy `eventType`), `since`, `until`, `includePayload`
- **200**: `{ events[], nextCursor? }`
- **400** (stable codes on validation paths):
  - `QUERY_VALIDATION_FAILED` (query schema issues like invalid `limit`, malformed window, non-boolean `includePayload`)
  - `INVALID_CURSOR` (cursor decode/shape failure)
- **Notes:**
  - `since` and `until` must be provided together.
  - `type` supports exact and prefix (`entity_*`) matching.

### `POST /events`
- **Headers:** optional `Idempotency-Key`
- **Body:** `{ type, payload }`
- **201**: `{ id, type }`
- **400** (stable codes on validation paths):
  - `BODY_JSON_INVALID` (request body is not valid JSON)
  - `BODY_VALIDATION_FAILED` (schema/body validation failures not covered by a more specific code)
  - `INVALID_IDEMPOTENCY_KEY` (header exceeds maximum length)
  - `INVALID_TWIN_INGEST_TYPE` (writer rejects event type)
  - `TWIN_INGEST_PAYLOAD_TOO_LARGE` (payload byte cap exceeded)
- **Oversized payload example:**
```json
{
  "error": "Ingest payload exceeds maximum size.",
  "code": "TWIN_INGEST_PAYLOAD_TOO_LARGE"
}
```

### `GET /events/export`
- **Query:** `format=json|csv`, plus `type`/`eventType`, `since`, `until`, `includePayload`
- **200 JSON:** `{ events[] }`
- **200 CSV:** downloadable `text/csv`
- **Precedence:** when both `type` and legacy `eventType` are present, `type` is used.
- **400** (stable codes on validation paths):
  - `QUERY_VALIDATION_FAILED` (invalid base events query params reused by export route)
  - `FORMAT_INVALID` (format is not `json` or `csv`)
  - `EXPORT_ROW_CAP_EXCEEDED` (result set exceeds export row cap)

## Risk Signals

### `GET /risk-signals`
- **Query:** `limit`, `cursor`, `severity`
- **200**: `{ items[], nextCursor? }`

### `PATCH /risk-signals/{id}`
- **Body:** `{ acknowledged: boolean }`
- **200**:
```json
{
  "id": "risk_123",
  "acknowledged": true,
  "acknowledgedAt": "2026-04-28T16:05:00.000Z",
  "acknowledgedByActorId": "user_1"
}
```

## Scenarios

### `GET /scenarios`
- **Query:** `limit`, `cursor`
- **200**: `{ items[], nextCursor? }`

### `POST /scenarios`
- **Body:** `{ title?, draft }`
- **201**: `{ id, title, status, updatedAt }`

### `GET /scenarios/{id}`
- **200**: `{ id, title, status, createdAt, updatedAt, draftJson }`

### `PATCH /scenarios/{id}`
- **Body:** partial `{ title?, draft?, status? }`
- **200**: same as detail response.
- **400** (stable code): oversized draft returns:
```json
{
  "error": "Scenario draft JSON exceeds maximum size.",
  "code": "TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE"
}
```

### `DELETE /scenarios/{id}`
- **204** on success.

### `POST /scenarios/{id}/duplicate`
- **Body:** `{ titleSuffix? }`
- **201**: new draft list item shape.

### `GET /scenarios/{id}/history`
- **200**: metadata-only timeline:
  - `id`, `createdAt`, `actorId`, `action`
  - `titleBefore`, `titleAfter`, `statusBefore`, `statusAfter`
- **No `draft` / `draftJson` payloads** are returned by this endpoint.

## Entitlement Gate (Slice 96)
- Twin APIs are centrally gated by shared access helper behavior.
- When module entitlement is disabled, APIs return:
```json
{
  "error": "Forbidden: Supply Chain Twin is not enabled for this tenant."
}
```
