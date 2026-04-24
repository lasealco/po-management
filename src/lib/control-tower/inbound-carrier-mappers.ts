/**
 * Example **carrier-specific** mappers: translate a partner’s JSON into the same
 * `carrierPayload` shape as `payloadFormat: generic_carrier_v1` (see `inbound-webhook.ts`).
 * Add new files or functions here as real carrier contracts are onboarded.
 */

const MAX_CODE = 80;
const CODE_RE = /^[A-Za-z0-9._-]+$/;

function parseIsoDate(v: unknown): Date | null | "invalid" {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

function sanitizeMilestoneCode(raw: string): string | null {
  const t = raw.trim().slice(0, MAX_CODE);
  if (!t || !CODE_RE.test(t)) return null;
  return t;
}

/** Public name for `payloadFormat` — illustrative “SeaPort Terminal” partner schema. */
export const SEA_PORT_TRACK_V1_FORMAT = "sea_port_track_v1" as const;

/**
 * Fictional **SeaPort Track** push API: nested `seaPortEvent` uses shipping-line verbs
 * instead of our milestone codes. Maps to `generic_carrier_v1` fields.
 *
 * Expected fields (all string unless noted):
 * - `consignmentCuid` | `shipmentId` | `shipment_id` — our shipment id
 * - `activityType` | `activity_type` — e.g. BERTH, DISCH, LOAD (see map below)
 * - `eventTimestamp` | `event_timestamp` | `eventUtc` | `event_utc` — ISO time
 * - Optional: `freeText` | `narrative`, `eventRef` | `portalRef`
 */
const SEA_PORT_ACTIVITY_TO_MILESTONE: Record<string, string> = {
  BERTH: "BERTH_ARR",
  VESSEL_ARR: "BERTH_ARR",
  VESSELARR: "BERTH_ARR",
  SAIL: "OCEAN_DEP",
  DEPART: "OCEAN_DEP",
  OCEAN_DEP: "OCEAN_DEP",
  DISCH: "PORT_DISCH",
  DISCHARGE: "PORT_DISCH",
  LOAD: "PORT_LOAD",
  LADEN: "PORT_LOAD",
  GATE_IN: "GATE_IN",
  CY_IN: "CY_IN",
  EMPTY_RET: "EMPTY_RTN",
  EMPTY_RETURN: "EMPTY_RTN",
};

export function mapSeaPortTrackEventToGenericCarrierPayload(
  seaPort: Record<string, unknown>,
): { ok: true; carrierPayload: Record<string, unknown> } | { ok: false; error: string } {
  const shipmentId =
    (typeof seaPort.consignmentCuid === "string" && seaPort.consignmentCuid.trim()) ||
    (typeof seaPort.shipmentId === "string" && seaPort.shipmentId.trim()) ||
    (typeof seaPort.shipment_id === "string" && seaPort.shipment_id.trim()) ||
    "";
  if (!shipmentId) {
    return { ok: false, error: "consignmentCuid | shipmentId | shipment_id required" };
  }

  const activityRaw =
    (typeof seaPort.activityType === "string" && seaPort.activityType.trim()) ||
    (typeof seaPort.activity_type === "string" && seaPort.activity_type.trim()) ||
    "";
  if (!activityRaw) {
    return { ok: false, error: "activityType (or activity_type) required" };
  }

  const tsRaw =
    seaPort.eventTimestamp ?? seaPort.event_timestamp ?? seaPort.eventUtc ?? seaPort.event_utc;
  const eventTime = parseIsoDate(tsRaw);
  if (eventTime === "invalid") return { ok: false, error: "invalid event timestamp" };
  if (eventTime == null) {
    return { ok: false, error: "eventTimestamp | eventUtc (or snake_case aliases) required" };
  }

  const norm = activityRaw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  let code = norm ? SEA_PORT_ACTIVITY_TO_MILESTONE[norm] : undefined;
  if (!code) {
    const suffix = norm || "UNKNOWN";
    code = `SPT_${suffix}`.slice(0, MAX_CODE);
  }
  const eventCode = sanitizeMilestoneCode(code);
  if (!eventCode) {
    return { ok: false, error: "could not derive a valid milestone event_code" };
  }

  const freeText =
    (typeof seaPort.freeText === "string" && seaPort.freeText.trim().slice(0, 4000)) ||
    (typeof seaPort.narrative === "string" && seaPort.narrative.trim().slice(0, 4000)) ||
    "";
  const eventRef =
    (typeof seaPort.eventRef === "string" && seaPort.eventRef.trim().slice(0, 240)) ||
    (typeof seaPort.portalRef === "string" && seaPort.portalRef.trim().slice(0, 240)) ||
    "";

  return {
    ok: true,
    carrierPayload: {
      shipment_id: shipmentId,
      event_code: eventCode,
      event_time: eventTime.toISOString(),
      ...(freeText ? { message: freeText } : {}),
      ...(eventRef ? { external_ref: eventRef } : {}),
    },
  };
}
