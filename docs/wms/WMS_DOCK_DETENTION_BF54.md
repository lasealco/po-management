# Yard detention & trailer clocks — BF-54 (minimal)

**Purpose:** Surface **yard detention-style clocks** from existing **`WmsDockAppointment`** milestones (**BF-05** gate / at-dock / departed timestamps) using a **tenant JSON policy** and **on-read evaluation** — without carrier billing or TMS certification.

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-54; catalog [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md).

---

## What shipped

| Piece | Details |
|-------|---------|
| **Policy** | `Tenant.wmsDockDetentionPolicyJson` — `{ "enabled": true \| false, "freeMinutesGateToDock": number, "freeMinutesDockToDepart": number }` (defaults 120 / 240 when parsing partial objects). |
| **POST** | `set_wms_dock_detention_policy` — setup tier; `dockDetentionPolicyClear: true` clears JSON. |
| **On-read alerts** | `collectDockDetentionAlerts` — for each **SCHEDULED** appointment: if gate in & not at dock, compare elapsed minutes to `freeMinutesGateToDock`; if at dock & not departed, compare to `freeMinutesDockToDepart`. |
| **Payload** | `GET /api/wms` includes `dockDetentionPolicy`, `dockDetentionAlerts`, and per-row `detentionAlert` on `dockAppointments`. |
| **Home KPIs** | `fetchWmsHomeKpis.dockDetentionOpenAlerts` + methodology bullet in `WMS_HOME_KPI_METHODOLOGY`; `/wms` executive card. |
| **Timeline / CT** | On **`AT_DOCK`** or **`DEPARTED`**, if the **completed segment** exceeded policy, append **`CtAuditLog`** `action: dock_detention_breach` (entity `WMS_DOCK_APPOINTMENT`) — shows in **BF-49** `GET /api/control-tower/timeline` (`ct_audit` lane). |

## UI

- **`/wms/setup`** — **Dock detention (BF-54)** panel (enable + thresholds + clear).
- **`/wms`** — **Dock detention (BF-54)** count on At a glance.
- **Operations** dock grid — **Detention** column when policy enabled and trailer is over threshold.

## Out of scope

Carrier-accessorial billing, automated invoices, detention fee disputes, per-dock override matrices, cron jobs (minimal slice is on-read + milestone audit only).

---

_Last updated: 2026-05-05 — BF-54 minimal slice._
