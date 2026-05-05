# BF-71 — Outbound logistics unit serial aggregation

**Goal:** Link BF-13 **`WmsInventorySerial`** rows to BF-43 **`WmsOutboundLogisticsUnit`** on an **`OutboundOrder`**, compute **subtree-aggregated** serial lists per LU, validate line/product consistency, and export a versioned JSON manifest.

## Schema

- **`WmsOutboundLuSerial`** — `tenantId`, `outboundOrderId`, `logisticsUnitId`, `serialId`; **`@@unique([outboundOrderId, serialId])`** (one attachment per serial per order) and **`@@unique([logisticsUnitId, serialId])`**.

## API

| Surface | Purpose |
|--------|---------|
| **`POST /api/wms`** `link_outbound_lu_serial_bf71` | Attach serial to LU (`outboundOrderId`, `logisticsUnitId`, `inventorySerialId`). **Inventory / serial-registry** ACL. Blocks **SHIPPED** / **CANCELLED**. |
| **`POST /api/wms`** `unlink_outbound_lu_serial_bf71` | Remove link (same payload). |
| **`POST /api/wms`** `validate_outbound_serial_aggregation_bf71` | Pure evaluation: errors (unknown LU on link, line/product mismatch, hierarchy cycle), warnings (leaf line + qty hint but no subtree serials). **Operations** tier. |
| **`GET /api/wms/outbound-serial-manifest-export?outboundOrderId=&pretty=1`** | JSON **`wms.outbound_serial_manifest.bf71.v1`** when outbound is **PACKED** or **SHIPPED** (same readiness band as BF-67 manifest export). |

**Audit:** `CtAuditLog` actions `bf71_outbound_lu_serial_linked` / `bf71_outbound_lu_serial_unlinked` on entity **`OUTBOUND_ORDER`**.

## Payload

**`GET /api/wms`** outbound **`logisticsUnits[]`** include **`luSerials[]`**: `{ serialId, serialNo, productId }` per direct link on that LU.

## Deploy gates

- **`WMS_ENFORCE_BF71_SERIAL_AGGREGATION=1`** — when the order has **any** BF-71 links, **`mark_outbound_shipped`** runs the same evaluator and **blocks** ship if **`ok`** is false.

## UI

Outbound BF-43 panel: validate BF-71, link/unlink (serial-registry grant), LU table column for linked serial numbers, **Export serial manifest JSON** when PACKED/SHIPPED (requires logistics units).

## Out of scope

EPCIS repositories, OEM serialization hubs (see mega-phase doc).

_Last updated: 2026-04-29._
