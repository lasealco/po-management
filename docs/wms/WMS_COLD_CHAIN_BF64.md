# BF-64 — Cold-chain custody segments (minimal)

## Purpose

Capture **temperature / custody segment** evidence on **`InventoryMovement`** and **`Shipment`** as JSON (no IoT SDK). Breach signals write **`CtAuditLog`** rows surfaced on the **BF-49** operations timeline (`ct_audit` source).

## Data model

| Field | Model | Notes |
|-------|--------|--------|
| `custodySegmentJson` | `InventoryMovement` | Optional `Json` object (e.g. `minTempC`, `maxTempC`, `probeTempC`, `breached`). |
| `custodySegmentJson` | `Shipment` | Same; inbound shipment-level segment. |

## Documented JSON shape (all keys optional)

- `minTempC`, `maxTempC`, `probeTempC` — numbers (°C). If all three are finite and probe is outside `[min, max]`, a **breach** is inferred.
- `breached` or `breach` — boolean `true` forces breach.
- `segmentLabel`, `note` — strings for operator context.

Max serialized size **8192** bytes (see `src/lib/wms/custody-segment-bf64.ts`).

## Mutations

| Action | Payload |
|--------|---------|
| `set_shipment_inbound_fields` | Optional `custodySegmentJson` — object sets, `null` clears (can be the only field). |
| `set_inventory_movement_custody_segment_bf64` | `inventoryMovementId`, `custodySegmentJson` (object or `null` to clear). |

## Audits & timeline

- **Breach** (`cold_chain_custody_breach_bf64`): written when the stored segment indicates a breach (explicit flag or probe out of band).
- Movement-linked rows: if `referenceType === "SHIPMENT"` and `referenceId` is set, **`shipmentId`** on `CtAuditLog` is filled for CT roll-ups.
- **BF-49** inventory-movement rows now include `custodySegmentJson` in **`detail`** for read-side context.

## UI

- **Stock & ledger**: BF-64 panel + **Custody** column (prefills form on **Edit**).
- **Inbound**: **Cold (BF-64)** column; expandable row to apply / clear shipment custody JSON.

## Out of scope

Probe hardware, refrigerated trailer telematics, and automated excursion workflows.
