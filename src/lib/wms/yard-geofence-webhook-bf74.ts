import { parseDockYardMilestone, type WmsDockYardMilestone } from "./dock-appointment";

export const YARD_GEOFENCE_WEBHOOK_SCHEMA_VERSION = "bf74.v1" as const;

const EXTERNAL_EVENT_ID_MAX = 128;

export type ParsedYardGeofenceWebhookPayload = {
  schemaVersion: typeof YARD_GEOFENCE_WEBHOOK_SCHEMA_VERSION;
  dockAppointmentId: string;
  tenantSlug: string;
  externalEventId: string;
  yardMilestone: WmsDockYardMilestone;
  yardOccurredAt: string | undefined;
};

function trimOpt(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  return s || undefined;
}

/** Parses JSON body for POST /api/wms/yard-geofence-webhook. */
export function parseYardGeofenceWebhookPayload(raw: unknown): ParsedYardGeofenceWebhookPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;

  const dockAppointmentId = trimOpt(rec.dockAppointmentId);
  if (!dockAppointmentId) return null;

  const externalEventIdRaw = trimOpt(rec.externalEventId);
  if (!externalEventIdRaw) return null;
  const externalEventId = externalEventIdRaw.slice(0, EXTERNAL_EVENT_ID_MAX);

  const tenantSlugRaw = trimOpt(rec.tenantSlug);
  const tenantSlug = tenantSlugRaw ?? "demo-company";

  const yardMilestone = parseDockYardMilestone(rec.yardMilestone);
  if (!yardMilestone) return null;

  const yardOccurredAt = trimOpt(rec.yardOccurredAt);

  const schemaRaw = trimOpt(rec.schemaVersion);
  if (schemaRaw && schemaRaw !== YARD_GEOFENCE_WEBHOOK_SCHEMA_VERSION) return null;

  return {
    schemaVersion: YARD_GEOFENCE_WEBHOOK_SCHEMA_VERSION,
    dockAppointmentId,
    tenantSlug,
    externalEventId,
    yardMilestone,
    yardOccurredAt,
  };
}
