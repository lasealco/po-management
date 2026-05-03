# BF-63 — Catch-weight receiving (minimal)

## Data model

| Field | Model | Role |
|-------|--------|------|
| `isCatchWeight` | `Product` | Line participates in catch-weight policy when true. |
| `catchWeightLabelHint` | `Product` | Optional operator / label hint (UI + payloads). |
| `catchWeightTolerancePct` | `Shipment` | Optional 0–100 band: allowed %-delta of **net kg** vs declared weight on the line. |
| `catchWeightKg` | `ShipmentItem` | Scale-reported net kg (nullable). |
| `cargoGrossWeightKg` | `ShipmentItem` | Declared kg anchor for tolerance (existing field). |

## Evaluation

- **`evaluateCatchWeightAgainstTolerance`** (`src/lib/wms/catch-weight-receipt.ts`) — skips non–catch-weight lines and lines without positive declared kg; when `catchWeightTolerancePct` is set, every in-policy catch-weight line must have `catchWeightKg` within the band.
- **`evaluate_wms_receipt_asn_tolerance`** — still returns BF-31 qty block; adds **`catchWeight`** (`tolerancePct`, `policyApplied`, `withinTolerance`, `lines[]`).

## Dock receipt close

**`close_wms_receipt`** (in addition to BF-31 flags):

- `requireWithinCatchWeightForAdvance` — do not advance receiving to **Receipt complete** when catch-weight policy applies but evaluation fails.
- `blockCloseIfOutsideCatchWeight` — return **400** when policy applies but evaluation fails.

Audit payload includes `catchWeightPolicyApplied`, `catchWeightWithin`, optional `catchWeightTolerancePct`, and `receiveStatusSkippedDueToCatchWeight` when relevant.

## Mutations

| Action | Notes |
|--------|--------|
| `set_shipment_inbound_fields` | `catchWeightTolerancePct` (0–100 or clear). |
| `set_shipment_item_receive_line` | Optional `catchWeightKg`. |
| `set_wms_receipt_line` | Optional `catchWeightKg`. |
| `set_shipment_item_catch_weight` | Set/clear `catchWeightKg` without changing received qty. |
| `set_product_catch_weight_bf63` | `isCatchWeight` and/or `catchWeightLabelHint`. |

## Operations UI

Inbound grid: **Catch wt %** on shipment row; line table **Decl kg** / **Catch kg**; dock close checkboxes for BF-63. Setup: **BF-33** section includes **BF-63 — Catch-weight product** card.

## Out of scope

Legal-for-trade scale certification and certified device integrations.
