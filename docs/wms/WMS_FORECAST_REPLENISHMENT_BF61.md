# BF-61 — Forecast-driven replenishment hints (minimal slice)

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-61; extends **BF-35** [`WMS_REPLENISHMENT_BF35.md`](./WMS_REPLENISHMENT_BF35.md).

## Landed behavior

| Surface | Detail |
|--------|--------|
| **Model** | **`WmsDemandForecastStub`** — `tenantId`, `warehouseId`, `productId`, **`weekStart`** (`@db.Date`, UTC Monday bucket), **`forecastQty`**, optional **`note`**, **`createdById`**; **`@@unique([tenantId, warehouseId, productId, weekStart])`**. |
| **POST** | **`upsert_wms_demand_forecast_stub`** — `warehouseId`, `productId`, `forecastQty` (≥ 0), optional `weekStart` (`YYYY-MM-DD`, normalized to UTC Monday; omit = current week), optional `note`. **`org.wms.operations` → edit** or legacy **`org.wms` → edit**. |
| **Batch** | **`create_replenishment_tasks`** loads stubs for **current UTC week**; **`forecastGapQty = max(0, forecast − pickFaceEffective)`** using **BF-84 effective** forecast when **`promoUpliftBf84Json`** is set (same pick-face / zone filter and soft-reservation math as shortage logic); tiered **priority boost** (5 / 15 / 30 / 50) applied in **`sortReplenishmentRulesForBatch`**. **`WmsTask.replenishmentPriority`** snapshots **`rule.priority + boost`**. |
| **GET** | **`GET /api/wms`** includes **`demandForecastStubs`** (current week, scoped; base qty + effective qty + **`promoUpliftBf84`**) and **`forecastGapHints`** (per active rule: base forecast, uplift multiplier, effective forecast, pick-face effective, gap, boost, effective sort priority). |
| **UI** | **`/wms`** — **Demand forecast stub (BF-61)** panel: hint grid + saved stubs + save form; optional **BF-84** uplift × + promo note + clear uplift checkbox. |

## Out of scope

Statistical or ML forecasting engines; ERP demand interfaces.

_Last updated: 2026-04-29 — BF-61 minimal stub; **BF-84** promo uplift JSON on stub ([`WMS_PROMO_UPLIFT_BF84.md`](./WMS_PROMO_UPLIFT_BF84.md))._
