# BF-37 — Cross-dock / flow-through tagging (minimal slice)

**Objective:** Tag inbound **`Shipment`** rows for **cross-dock** and **flow-through**, surface them in Operations, and **prefer `WarehouseBin.isCrossDockStaging`** bins first when automated waves order pick slots (all allocation paths share the same staging-first tie-break).

## Schema

| Model | Field | Meaning |
| ----- | ----- | ------- |
| **`Shipment`** | `wmsCrossDock` | Inbound cross-dock program flag |
| **`Shipment`** | `wmsFlowThrough` | Flow-through style moves |
| **`WarehouseBin`** | `isCrossDockStaging` | Outbound wave ordering prefers these bins among ties |

## API (`POST /api/wms`)

| Action | Body fields |
| ------ | ----------- |
| **`set_shipment_inbound_fields`** | Optional `wmsCrossDock`, `wmsFlowThrough` (booleans) alongside existing ASN / expected receive / tolerance fields |
| **`create_bin`** | Optional `isCrossDockStaging` |
| **`update_bin_profile`** | Optional `isCrossDockStaging` |

## Allocation

`WavePickSlot` carries `isCrossDockStaging`. **`crossDockStagingFirstCmp`** runs as the first tie-break inside **`orderPickSlotsForWave`**, **`orderPickSlotsMinBinTouches`**, **`orderPickSlotsMinBinTouchesReservePickFace`**, cube-aware variants, and solver subset sorting (**BF-34**).

## UI

**Stock → Operations → Inbound / ASN:** tag filter (all / cross-dock / flow-through / either), XD / FT columns, editable checkboxes on save (setup role). **Stock → Setup → Bins:** XD staging column; **Create bin** includes **XD staging**.

## Out of scope (same as mega-phases)

Yard automation, automated dock-door slotting.

See also [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md).
