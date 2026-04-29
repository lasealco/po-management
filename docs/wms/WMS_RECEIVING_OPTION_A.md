# ADR: WMS receiving state machine — Option A on `Shipment`

**Status:** Accepted (implementation WE-01) · **Date:** 2026-04-29

## Context

[`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md) defines logical receiving states and three implementation options (A: columns on `Shipment`, B: receipt tables, C: milestones-only).

## Decision

**Option A** — Add first-class WMS fields on **`Shipment`**:

- `wmsReceiveStatus` (`WmsReceiveStatus` enum)
- Optional `wmsReceiveNote`, `wmsReceiveUpdatedAt`, `wmsReceiveUpdatedById`

Transitions are explicit via **`POST /api/wms`** action **`set_wms_receiving_status`** (`shipmentId`, `toStatus`, optional `note`). Setting ASN / ETA via **`set_shipment_inbound_fields`** may automatically move **`NOT_TRACKED` → `EXPECTED`** when ASN or ETA is present (documented system rule in [`post-actions.ts`](../../src/lib/wms/post-actions.ts)).

## Consequences

- **Pros:** One row per PO shipment of record; simple queries for `/wms` inbound table; aligns with existing ASN/ETA editing.
- **Cons:** Line-level variances and dock appointments remain future work (Option B / separate capsules); states are header-level only until extended.

## Audit

Each transition writes **`CtAuditLog`** with `entityType: SHIPMENT`, `action: wms_receive_transition`, and JSON payload (`from`, `to`, `source`).
