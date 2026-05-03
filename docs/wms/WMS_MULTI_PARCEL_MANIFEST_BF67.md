# BF-67 — Multi-parcel outbound shipment manifest

**Scope:** Persist **multiple carrier / package tracking identifiers** on an **`OutboundOrder`** (`manifestParcelIds` JSON string[]) alongside the optional **primary** **`carrierTrackingNo`** from **BF-39**, and export a vendor-neutral **manifest JSON** for middleware or carrier portals.

## Data model

- **`OutboundOrder.manifestParcelIds`** — `JSONB` array of non-empty strings (max **50** ids, each max **128** chars; duplicates rejected on save).

## API

### `POST /api/wms`

- **`set_outbound_manifest_parcel_ids_bf67`** — `outboundOrderId`, **`manifestParcelIds`** (array of strings; empty array clears the list). Blocked when outbound status is **`CANCELLED`**. Requires **`operations`** tier (or legacy **`org.wms` → edit**).

### `GET /api/wms/outbound-manifest-export`

- Query: **`outboundOrderId`** (required), optional **`pretty=1`** for indented JSON.
- Auth: **`org.wms` → view**; respects **`loadWmsViewReadScope`** like other outbound reads.
- **400** unless outbound is **`PACKED`** or **`SHIPPED`**.
- **400** if both **`manifestParcelIds`** and **`carrierTrackingNo`** are empty (nothing to manifest).
- Response: attachment **`{outboundNo}-outbound-manifest-bf67.json`**, schema **`bf67.v1`** (see `buildOutboundManifestExportV1` in `src/lib/wms/outbound-manifest-bf67.ts`).
- **`allTrackingNumbers`**: primary label (if present) first, then manifest ids, case-insensitive dedupe.

## Dashboard / partner

- **`GET /api/wms`** includes **`manifestParcelIds`** on each outbound (normalized string array).
- **`GET /api/wms/partner/v1/outbound-orders/[id]`** includes **`manifestParcelIds`** (same normalization).
- Operations **Outbound & ship station**: **BF-67 · Multi-parcel manifest** panel + **Export manifest JSON** when packed/shipped and at least one tracking source exists.

## Tests

- `src/lib/wms/outbound-manifest-bf67.test.ts` — parse rules + export merge behavior.

## Out of scope

- LTL freight BOL generation, certified carrier API filing, PDF rendering.
