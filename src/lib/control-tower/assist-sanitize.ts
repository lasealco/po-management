import type { ShipmentStatus, TransportMode } from "@prisma/client";

import type { AssistSuggestedFilters } from "@/lib/control-tower/assist";
import { CT_URL_ROUTE_ACTION_PREFIXES } from "@/lib/control-tower/workbench-url-sync";

const VALID_STATUSES = new Set<ShipmentStatus>([
  "BOOKING_DRAFT",
  "BOOKING_SUBMITTED",
  "SHIPPED",
  "VALIDATED",
  "BOOKED",
  "IN_TRANSIT",
  "DELIVERED",
  "RECEIVED",
]);

const VALID_MODES = new Set<TransportMode>(["OCEAN", "AIR", "ROAD", "RAIL"]);

const MAX_Q = 240;
const MAX_LANE = 12;
const MAX_PORT_CODE = 10;

function isProbableAssistCuid(s: string): boolean {
  return s.length >= 20 && s.length <= 32 && /^c[a-z0-9]+$/i.test(s);
}

function sanitizePortCodeField(raw: string): string | undefined {
  const t = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t.length < 3 || t.length > MAX_PORT_CODE) return undefined;
  return t.slice(0, MAX_PORT_CODE);
}

/** Keep only API-safe filter fields from an untrusted object (LLM or client). */
export function sanitizeAssistSuggestedFilters(input: unknown): AssistSuggestedFilters {
  if (!input || typeof input !== "object") return {};
  const o = input as Record<string, unknown>;
  const out: AssistSuggestedFilters = {};

  if (typeof o.q === "string") {
    const t = o.q.trim().slice(0, MAX_Q);
    if (t) out.q = t;
  }
  if (typeof o.mode === "string" && VALID_MODES.has(o.mode as TransportMode)) {
    out.mode = o.mode as TransportMode;
  }
  if (typeof o.status === "string" && VALID_STATUSES.has(o.status as ShipmentStatus)) {
    out.status = o.status as ShipmentStatus;
  }
  if (o.onlyOverdueEta === true) {
    out.onlyOverdueEta = true;
  }
  if (typeof o.lane === "string") {
    const raw = o.lane.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (raw.length >= 3 && raw.length <= MAX_LANE) out.lane = raw.slice(0, MAX_LANE);
  }
  if (typeof o.supplierId === "string") {
    const t = o.supplierId.trim();
    if (isProbableAssistCuid(t)) out.supplierId = t;
  }
  if (typeof o.customerCrmAccountId === "string") {
    const t = o.customerCrmAccountId.trim();
    if (isProbableAssistCuid(t)) out.customerCrmAccountId = t;
  }
  if (typeof o.carrierSupplierId === "string") {
    const t = o.carrierSupplierId.trim();
    if (isProbableAssistCuid(t)) out.carrierSupplierId = t;
  }
  if (typeof o.originCode === "string") {
    const t = sanitizePortCodeField(o.originCode);
    if (t) out.originCode = t;
  }
  if (typeof o.destinationCode === "string") {
    const t = sanitizePortCodeField(o.destinationCode);
    if (t) out.destinationCode = t;
  }
  if (typeof o.routeAction === "string") {
    const t = o.routeAction.trim();
    if (CT_URL_ROUTE_ACTION_PREFIXES.has(t)) out.routeAction = t;
  }
  if (typeof o.dispatchOwnerUserId === "string") {
    const t = o.dispatchOwnerUserId.trim();
    if (isProbableAssistCuid(t)) out.dispatchOwnerUserId = t;
  }
  if (typeof o.shipmentSource === "string") {
    const u = o.shipmentSource.trim().toUpperCase();
    if (u === "PO") out.shipmentSource = "PO";
    else if (u === "UNLINKED" || u === "EXPORT") out.shipmentSource = "UNLINKED";
  }

  return out;
}

export function mergeAssistSuggestedFilters(
  base: AssistSuggestedFilters,
  patch: AssistSuggestedFilters,
): AssistSuggestedFilters {
  const out: AssistSuggestedFilters = { ...base };
  for (const key of Object.keys(patch) as (keyof AssistSuggestedFilters)[]) {
    const v = patch[key];
    if (v === undefined) continue;
    if (key === "onlyOverdueEta") {
      if (v === true) out.onlyOverdueEta = true;
      else delete out.onlyOverdueEta;
      continue;
    }
    if (typeof v === "string" && !v.trim()) {
      delete out[key];
      continue;
    }
    (out as Record<string, unknown>)[key] = v;
  }
  return out;
}
