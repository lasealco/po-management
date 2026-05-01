# WMS dock appointments (WE-02)

**Status:** Implemented slice · **Last updated:** 2026-05-01

## Scope

Minimal **tenant-scoped dock/window scheduling** for inbound PO shipments and outbound orders:

- **Schema:** `WmsDockAppointment` with `warehouseId`, normalized `dockCode`, `[windowStart, windowEnd)`, `direction` (`INBOUND` \| `OUTBOUND`), optional link to exactly one of `Shipment` or `OutboundOrder`, `status` (`SCHEDULED` \| `CANCELLED` \| `COMPLETED`).
- **BF-05:** Optional **carrier / trailer** metadata (`carrierName`, `carrierReference`, `trailerId`) and **yard milestone** timestamps (`gateCheckedInAt`, `atDockAt`, `departedAt`). Depart milestone completes the appointment (`status` → **`COMPLETED`**). See [`WMS_DOCK_YARD_BF05.md`](./WMS_DOCK_YARD_BF05.md).
- **BF-17:** Optional **TMS stub columns** on the same row — **`tmsLoadId`**, **`tmsCarrierBookingRef`**, **`tmsLastWebhookAt`** — plus **`set_dock_appointment_tms_refs`** and Bearer **`POST /api/wms/tms-webhook`** (details below).
- **Conflict rule:** Creating a `SCHEDULED` row fails with HTTP **409** when another `SCHEDULED` appointment for the same tenant + warehouse + dock code has an **overlapping** time window (same semantics as `rangesOverlap` in `src/lib/wms/dock-appointment.ts`).
- **API:** `POST /api/wms` actions `create_dock_appointment`, `cancel_dock_appointment`, **`set_dock_appointment_transport`**, **`set_dock_appointment_tms_refs`**, **`record_dock_appointment_yard_milestone`**; **read** via `dockAppointments` on `GET /api/wms`.
- **UI:** WMS **Operations** — **Dock appointments** panel plus **Schedule dock** on inbound rows (requires operations warehouse selection) and **Dock window** on outbound orders.

## TMS integration stub (BF-17)

This is **not** a certified TMS — only **schema + webhook placeholders** so a future carrier integration can push identifiers and optional yard milestones without refactoring BF-05 handlers.

| Surface | Notes |
|---------|--------|
| **`set_dock_appointment_tms_refs`** | Authenticated `POST /api/wms` (**operations** tier). Updates **`tmsLoadId`** / **`tmsCarrierBookingRef`** (JSON **`null`** clears). **`CANCELLED`** rows rejected. Audited as **`dock_tms_refs_updated`**. |
| **`POST /api/wms/tms-webhook`** | **No session cookie.** Requires **`Authorization: Bearer <TMS_WEBHOOK_SECRET>`**; configure **`TMS_WEBHOOK_SECRET`** from **`docs/wms/tms-webhook.env.example`**. If the secret is **unset**, returns **503**. Body JSON: **`dockAppointmentId`** (required), **`tenantSlug`** (optional; defaults **`demo-company`**), optional **`tmsLoadId`** / **`tmsCarrierBookingRef`** (omit field to leave unchanged; **`null`** clears), optional **`yardMilestone`** (`GATE_IN` \| `AT_DOCK` \| `DEPARTED`) + **`yardOccurredAt`** ISO — milestones apply only when **`status = SCHEDULED`**. Always bumps **`tmsLastWebhookAt`**. **`CtAuditLog`** action **`tms_webhook_stub`**. |

## Non-goals

Full **TMS**, carrier negotiation, yard management, or automated slot optimization — blueprint deferrals beyond this slice stay separate.
