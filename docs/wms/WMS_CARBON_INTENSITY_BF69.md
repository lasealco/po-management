# BF-69 — Carbon intensity hints on movements

**Scope:** Optional **CO₂e estimate** (grams) and small **transport/distance stub** JSON on **`InventoryMovement`**, plus an optional **product-level** planning factor (**g CO₂e per kg·km**). Surfaces on **`GET /api/wms`** with a fixed **`movementCo2eHintMeta.methodology`** string. **Indicative planning only** — not GLEC-certified accounting.

## Schema

- **`InventoryMovement.co2eEstimateGrams`** — nullable `Decimal`.
- **`InventoryMovement.co2eStubJson`** — nullable JSON object; allowed keys: **`transportModeStub`** (string), **`distanceKm`** (non-negative finite number), **`note`** (string). Max serialized size **2048** bytes.
- **`Product.wmsCo2eFactorGramsPerKgKm`** — nullable `Decimal` (setup / master-data hint).

## API

### `POST /api/wms` actions

| Action | Tier | Body |
|--------|------|------|
| **`set_inventory_movement_co2e_hint_bf69`** | `inventory` (`org.wms.inventory → edit` path) | **`inventoryMovementId`**; at least one of **`co2eEstimateGrams`** (number / string / `null` to clear) and **`co2eStubJson`** (object / `null` to clear). Omitted fields are left unchanged. |
| **`set_product_wms_co2e_factor_bf69`** | `setup` | **`productId`**, **`wmsCo2eFactorGramsPerKgKm`** (non-negative number or `null` to clear). |

### `GET /api/wms`

- Each **`recentMovements[]`** row includes **`co2eEstimateGrams`** (string or `null`) and **`co2eStubJson`**.
- Each embedded **`product`** includes **`wmsCo2eFactorGramsPerKgKm`** (string or `null`).
- Root **`movementCo2eHintMeta`**: `{ schemaVersion: "bf69.v1", methodology: string }`.

## Implementation

- Validation / copy: [`src/lib/wms/carbon-intensity-bf69.ts`](../../src/lib/wms/carbon-intensity-bf69.ts) · Vitest [`src/lib/wms/carbon-intensity-bf69.test.ts`](../../src/lib/wms/carbon-intensity-bf69.test.ts).
- Mutations: [`src/lib/wms/post-actions.ts`](../../src/lib/wms/post-actions.ts); payload builder [`src/lib/wms/get-wms-payload.ts`](../../src/lib/wms/get-wms-payload.ts).

## Out of scope

Third-party **GLEC** audits, probe/telematics ingestion, automated tonne·km routing from TMS.
