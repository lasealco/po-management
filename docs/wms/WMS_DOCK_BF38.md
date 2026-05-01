# BF-38 — Dock door assignment & trailer checklist (minimal slice)

**Objective:** Extend **`WmsDockAppointment`** with optional **physical door** naming (distinct from **dock bay `dockCode`**), a persisted **trailer checklist JSON**, **yard-milestone validation**, and a lightweight **next booking hint** for dock planners.

## Schema (`prisma/schema.prisma`)

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `doorCode` | `String?` | Physical door / ramp assignment at the dock (normalized uppercase, max 64 chars). |
| `trailerChecklistJson` | `Json?` | Checklist payload `{ items: [{ id, label, required?, done }] }`. |

## API (`POST /api/wms`)

| Action | Notes |
| ------ | ----- |
| **`create_dock_appointment`** | Optional **`doorCode`**, **`trailerChecklistJson`** (validated shape). |
| **`update_dock_appointment_bf38`** | **`dockAppointmentId`** + optional **`doorCode`** / **`trailerChecklistJson`** (`null` clears each when included). **Cancelled** appointments rejected. |
| **`record_dock_appointment_yard_milestone`** | **DEPARTED:** rejects when persisted checklist has **required** rows still **`done: false`**. **AT_DOCK:** optional **`WMS_BF38_REQUIRE_DOOR_BEFORE_AT_DOCK=1`** env requires **`doorCode`** set first. |

Helpers and parsing live in **`src/lib/wms/dock-trailer-checklist.ts`** · **`defaultTrailerChecklistPayload()`** seeds four demo rows from Stock UI **Init checklist**.

## Payload (`GET /api/wms`)

Each **`dockAppointments`** row includes **`doorCode`**, **`trailerChecklistJson`** (normalized or `null`), and **`nextDockAppointmentWindowStart`** — ISO start of the chronologically **next SCHEDULED** appointment on the same **warehouse + dockCode** (same-dock “compression / sequencing” hint).

## UI

**Stock → Operations → Dock appointments:** Door column, window row shows **Next on dock** when applicable; expand row has **BF-38** panel (Save door, Init / Save / Clear checklist, checkboxes). Form supports optional door on **Schedule dock window**.

## Out of scope (mega-phases)

Full TMS solver, labor scheduling solver.

See [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) §BF-38 and [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md).
