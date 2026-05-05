# WMS search snapshot export (BF-99)

Shallow **JSON Lines** (**NDJSON**) index for external search appliances — **`Shipment`**, **`OutboundOrder`**, and **`WmsTask`** rows visible under the same **`org.wms` → view** + **`loadWmsViewReadScope`** rules as the main WMS dashboard.

## Endpoint

`GET /api/wms/search-snapshot`

## Query parameters

| Parameter | Description |
|-----------|-------------|
| `limit` | Lines per response (default **200**, min **1**, max **500**). |
| `cursor` | Opaque cursor from **`X-Search-Snapshot-Next-Cursor`** on the prior response; omit to start at the first segment. |
| `attachment` | Set to **`1`** to send **`Content-Disposition`** with filename **`wms-search-snapshot-bf99.ndjson`**. |

## Response

- **`Content-Type`:** `application/x-ndjson; charset=utf-8`
- **`X-Search-Snapshot-Schema`:** `bf99.v1`
- **`X-Search-Snapshot-Line-Count`:** number of lines in the body
- **`X-Search-Snapshot-Next-Cursor`:** present when more data remains (opaque **base64url** JSON `{ "v": 1, "s": 0..2, "a": "<lastId>|null" }`)

Segments run in order: **shipments** (`s=0`) → **outbound orders** (`s=1`) → **tasks** (`s=2`). Ordering within a segment is **`id` ascending** (string order).

Each body line is one JSON object:

- **`schemaVersion`:** `bf99.v1`
- **`entityType`:** `shipment` \| `outbound_order` \| `wms_task`
- **`tenantSlug`:** tenant slug for the demo tenant context
- Entity-specific shallow fields (identifiers, status enums as strings, key refs, **`updatedAt`** ISO timestamp).

## Out of scope

Hosting or syncing to Elasticsearch/OpenSearch clusters — consumers bring their own ingest pipeline.
