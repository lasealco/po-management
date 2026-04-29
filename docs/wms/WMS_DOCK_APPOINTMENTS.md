# WMS dock appointments (WE-02)

**Status:** Implemented slice · **Last updated:** 2026-04-29

## Scope

Minimal **tenant-scoped dock/window scheduling** for inbound PO shipments and outbound orders:

- **Schema:** `WmsDockAppointment` with `warehouseId`, normalized `dockCode`, `[windowStart, windowEnd)`, `direction` (`INBOUND` \| `OUTBOUND`), optional link to exactly one of `Shipment` or `OutboundOrder`, `status` (`SCHEDULED` \| `CANCELLED` \| `COMPLETED`).
- **BF-05:** Optional **carrier / trailer** metadata (`carrierName`, `carrierReference`, `trailerId`) and **yard milestone** timestamps (`gateCheckedInAt`, `atDockAt`, `departedAt`). Depart milestone completes the appointment (`status` → **`COMPLETED`**). See [`WMS_DOCK_YARD_BF05.md`](./WMS_DOCK_YARD_BF05.md).
- **Conflict rule:** Creating a `SCHEDULED` row fails with HTTP **409** when another `SCHEDULED` appointment for the same tenant + warehouse + dock code has an **overlapping** time window (same semantics as `rangesOverlap` in `src/lib/wms/dock-appointment.ts`).
- **API:** `POST /api/wms` actions `create_dock_appointment`, `cancel_dock_appointment`, **`set_dock_appointment_transport`**, **`record_dock_appointment_yard_milestone`**; **read** via `dockAppointments` on `GET /api/wms`.
- **UI:** WMS **Operations** — **Dock appointments** panel plus **Schedule dock** on inbound rows (requires operations warehouse selection) and **Dock window** on outbound orders.

## Non-goals

Full **TMS**, carrier negotiation, yard management, or automated slot optimization — blueprint deferrals beyond this slice stay separate.
