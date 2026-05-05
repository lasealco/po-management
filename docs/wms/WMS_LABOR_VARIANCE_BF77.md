# Labor variance exception queue — BF-77 (minimal)

**Purpose:** Surface **`WmsTask`** completions where **actual elapsed minutes** ( **`completedAt` − `startedAt`** ) exceed the task’s snapshotted **`standardMinutes`** by a **tenant-configurable** percentage — read-model queue on **`GET /api/wms`**, not payroll.

**Authority:** [`BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) §BF-77; builds on **BF-53** [`WMS_LABOR_BF53.md`](./WMS_LABOR_BF53.md).

## Schema

- **`Tenant.wmsLaborVariancePolicyJson`** — optional JSON: **`enabled`**, **`excessPercentThreshold`**, **`minActualMinutes`**, **`minStandardMinutes`**, **`lookbackDays`**, **`maxRows`**, optional **`taskTypes`** (`WmsTaskType[]`). Stored without **`schemaVersion`** (resolved at read time).

## POST (`/api/wms`)

| Action | Tier | Purpose |
|--------|------|---------|
| **`set_wms_labor_variance_policy`** | setup | Upsert policy from **`laborVarianceEnabled`** + optional numeric fields; or **`laborVariancePolicyClear: true`** → JSON null (queue disabled). |

## GET (`GET /api/wms`)

**`laborVarianceBf77`** — **`schemaVersion`**: **`bf77.v1`**; **`policy`** (resolved defaults); **`policyNotice`** when stored JSON was invalid; **`evaluatedAt`**; **`exceptions`** ( **`taskId`**, **`taskType`**, warehouse ref, **`actualMinutes`**, **`standardMinutes`**, **`excessMinutes`**, **`variancePctVsStandard`**, **`completedAt`**, **`completedBy`** ), capped by **`maxRows`**, scoped by **`loadWmsViewReadScope`** **`wmsTask`**.

Default when JSON is **null**: **`enabled: false`** (no exceptions until operators save policy).

## UI

- **`/wms/setup`** — BF-77 policy panel (save / clear).
- **`/wms/operations`** — exception table when enabled.

## Out of scope

Payroll gross pay export, engineered routing optimizers, LMS/WFM integrations.

_Last updated: 2026-04-29 — BF-77 minimal slice._
