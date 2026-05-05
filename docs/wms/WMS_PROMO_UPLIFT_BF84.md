# Promo uplift on forecast stub — BF-84

**Purpose:** Optional **`bf84.v1`** uplift multiplier on **`WmsDemandForecastStub`** so **BF-61** replenishment gap hints and **`create_replenishment_tasks`** sorting use **effective** forecast (`base × uplift`) without overwriting the stored administrative baseline.

**Authority:** [`BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) §BF-84; BF-61 stub [**`WMS_FORECAST_REPLENISHMENT_BF61.md`](./WMS_FORECAST_REPLENISHMENT_BF61.md).

---

## Schema

| Field | Model | Meaning |
|-------|--------|---------|
| **`promoUpliftBf84Json`** | **`WmsDemandForecastStub`** | Optional JSON (`bf84.v1`): **`upliftMultiplier`** (1–5), optional **`promoNote`** (≤200 chars). |

Stored **`forecastQty`** remains the **base** forecast; gap math uses **`effectiveForecastQtyBf84`**.

---

## JSON (`bf84.v1`)

| Key | Type | Meaning |
|-----|------|---------|
| **`schemaVersion`** | `"bf84.v1"` | Set on write (server). |
| **`upliftMultiplier`** | number | Clamped **1–5**. |
| **`promoNote`** | string | Optional operator label; allows keeping multiplier **1** with a visible note (stored JSON). |

Multiplier **1** with **no** **`promoNote`** clears uplift storage (**JSON null**).

---

## API / batch

| Surface | Detail |
|---------|--------|
| **`upsert_wms_demand_forecast_stub`** | Optional **`promoUpliftBf84`** object or **`promoUpliftBf84Clear: true`**. |
| **`GET /api/wms`** | **`demandForecastStubs`** includes **`forecastQtyEffective`**, **`promoUpliftBf84`** payload; **`forecastGapHints`** includes **`forecastQtyBase`**, **`promoUpliftMultiplier`**, **`forecastQty`** (effective). |
| **`create_replenishment_tasks`** | Loads **`promoUpliftBf84Json`** and applies effective qty for BF-61 boost. |

---

## Implementation

- [`src/lib/wms/promo-uplift-bf84.ts`](../../src/lib/wms/promo-uplift-bf84.ts)
- [`src/lib/wms/get-wms-payload.ts`](../../src/lib/wms/get-wms-payload.ts), [`src/lib/wms/post-actions.ts`](../../src/lib/wms/post-actions.ts)

---

## Tests

[`src/lib/wms/promo-uplift-bf84.test.ts`](../../src/lib/wms/promo-uplift-bf84.test.ts)

---

## Out of scope

Retail promo calendar ERP sync; automatic uplift from external pricing feeds.
