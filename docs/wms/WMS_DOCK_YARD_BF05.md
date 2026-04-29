# BF-05 — Dock yard ops slice (carrier + gate → dock → departed)

**Goal:** Extend **`WmsDockAppointment`** beyond calendar windows with **carrier / trailer metadata** and **yard milestone timestamps** aligned with blueprint “dock yard depth” — **without** TMS negotiation, carrier APIs, or automated slot optimization ([`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md) WE-02 baseline).

## Schema

| Field | Role |
|-------|------|
| `carrierName`, `carrierReference`, `trailerId` | Optional varchar metadata for gate/dock visibility (SCAC / PRO / trailer id). |
| `gateCheckedInAt`, `atDockAt`, `departedAt` | Optional timestamps for yard flow. |

## API (`POST /api/wms`)

| Action | Purpose |
|--------|---------|
| `create_dock_appointment` | Optional **`carrierName`**, **`carrierReference`**, **`trailerId`** (same truncation rules as update). |
| `set_dock_appointment_transport` | **`dockAppointmentId`** + any of **`carrierName`**, **`carrierReference`**, **`trailerId`** (JSON **`null`** clears). Not allowed when **`CANCELLED`**. |
| `record_dock_appointment_yard_milestone` | **`dockAppointmentId`**, **`yardMilestone`**: `GATE_IN` \| `AT_DOCK` \| **`DEPARTED`**, optional **`yardOccurredAt`** (ISO; defaults to now). **Only `SCHEDULED`** rows. **`DEPARTED`** sets **`departedAt`** and **`status` → `COMPLETED`**. |

**Audit:** `CtAuditLog` — `entityType` **`WMS_DOCK_APPOINTMENT`**, actions **`dock_transport_updated`**, **`dock_yard_milestone`** (payload includes milestone + occurredAt).

## Read model

`GET /api/wms` **`dockAppointments`** expose transport + yard fields.

## UI

WMS **Operations** → **Dock appointments**: carrier columns, yard summary, per-row **Save carrier** + **Gate in** / **At dock** / **Departed (complete)**.

## Residual (explicit backlog)

Full **TMS**, yard slot optimization, carrier **EDI**, automated check-in integrations — out of scope.
