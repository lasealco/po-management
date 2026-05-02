# Labor standards & task timing — BF-53 (minimal)

**Purpose:** Tenant-level **engineered standard minutes** per **`WmsTaskType`**, optional **floor timer** on open tasks (**`startedAt`**), and **home KPI** rollups vs **`completedAt`** — not LMS/payroll.

## Schema

- **`WmsLaborTaskStandard`** — `tenantId`, `taskType`, `standardMinutes` (unique per tenant + type).
- **`WmsTask`** — optional **`startedAt`**, optional **`standardMinutes`** (snapshot from standard at **create**).

## POST (`/api/wms`)

| Action | Tier | Purpose |
|--------|------|---------|
| **`set_wms_labor_task_standard`** | setup | Upsert standard for `laborTaskType` + `laborStandardMinutes` (1–10080). |
| **`start_wms_task`** | operations | Sets **`startedAt`** on an **OPEN** task if not already set (idempotent `alreadyStarted`). |

All **`wmsTask.create`** paths (putaway, pick, wave picks, replenishment automation, legacy cycle count task, value-add) copy **`standardMinutes`** when a row exists for that type.

## Home KPIs (`GET /api/wms?homeKpis=1`)

**`laborTiming`** — among **DONE** tasks in the last **7 days** with **`startedAt`** and **`completedAt`**, warehouse-scoped like other task counts:

- **`sampleCount`**, **`avgActualMinutes`**, **`avgStandardMinutes`** (only tasks that had a snapshot), **`efficiencyVsStandardPercent`** = (avg standard ÷ avg actual) × 100.

**`rateMethodology`** includes BF-20 bullets plus one BF-53 line (`WMS_HOME_KPI_METHODOLOGY` in `wms-home-kpis.ts`).

## UI

- **`/wms/setup`** — Labor standards (BF-53) table + save form.
- **`/wms/operations`** — **Start timer** per open task; **Std Nm** badge when snapshot present.
- **`/wms`** — Executive card **Labor timing (7d, BF-53)**.

## Out of scope

LMS/WFM, engineered labor routing, payroll gross pay, per-operator productivity attestations.

---

_Last updated: 2026-05-04 — BF-53 minimal slice._
