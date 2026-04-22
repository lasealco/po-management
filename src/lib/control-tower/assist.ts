import type { ShipmentStatus, TransportMode } from "@prisma/client";

import { CT_URL_ROUTE_ACTION_PREFIXES } from "@/lib/control-tower/workbench-url-sync";

/** Rule-based parse output for Search & assist (no LLM). */
export type AssistSuggestedFilters = {
  q?: string;
  mode?: TransportMode;
  status?: ShipmentStatus;
  onlyOverdueEta?: boolean;
  lane?: string;
  /** Next route action prefix; set from `route:<slug>` (e.g. `route:plan_leg`). */
  routeAction?: string;
  /** PO supplier id (Prisma cuid-style) when the user passes `supplier:…`. */
  supplierId?: string;
  /** CRM customer account id when the user passes `customer:…`. */
  customerCrmAccountId?: string;
  /** Shipment carrier supplier id when the user passes `carrier:…`. */
  carrierSupplierId?: string;
  /** Booking / leg origin port code (substring match) from `origin:…`. */
  originCode?: string;
  /** Booking / leg destination port code from `dest:` or `destination:`. */
  destinationCode?: string;
  /** PO-linked vs ad-hoc export shell from `source:po` / `source:unlinked` / `source:export`. */
  shipmentSource?: "PO" | "UNLINKED";
  /** Open alert/exception owner queue filter from `owner:…` / `assignee:…` / `dispatch:…` (user cuid). */
  dispatchOwnerUserId?: string;
  /** Open / in-progress exception `type` (catalog code) from `exception:…` or `ex:…`. */
  exceptionCode?: string;
  /** Open / acknowledged alert `type` from `alertType:` or `ctAlert:`. */
  alertType?: string;
  /** SKU / buyer code for Product trace from `trace:…`, `sku:…`, or `product:…`. */
  productTraceQ?: string;
};

const MAX_LIST_FILTER_TOKEN = 80;

function sanitizeListFilterToken(raw: string): string | undefined {
  const t = raw.trim().slice(0, MAX_LIST_FILTER_TOKEN);
  if (!t || !/^[\w.-]+$/i.test(t)) return undefined;
  return t;
}

const STATUS_WORDS: ShipmentStatus[] = [
  "BOOKING_DRAFT",
  "BOOKING_SUBMITTED",
  "SHIPPED",
  "VALIDATED",
  "BOOKED",
  "IN_TRANSIT",
  "DELIVERED",
  "RECEIVED",
];

const MODE_HINTS: Array<{ re: RegExp; mode: TransportMode; label: string }> = [
  { re: /\bFCL\b|\bLCL\b|ocean|vessel|container ship|bill of lading|b\/l\b/i, mode: "OCEAN", label: "Ocean" },
  { re: /\bAWB\b|air freight|flight\b/i, mode: "AIR", label: "Air" },
  { re: /\bFTL\b|\bLTL\b|truck|road\b/i, mode: "ROAD", label: "Road" },
  { re: /\brail\b|intermodal/i, mode: "RAIL", label: "Rail" },
  {
    re: /\bcourier\b|\bparcel\b|\bexpress\b|DHL|FedEx|UPS\b/i,
    mode: "ROAD",
    label: "Courier / parcel (mapped to road)",
  },
];

function stripOnce(text: string, pattern: RegExp): string {
  return text.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

function isProbableAssistCuid(s: string): boolean {
  return s.length >= 20 && s.length <= 32 && /^c[a-z0-9]+$/i.test(s);
}

function normalizePortToken(raw: string): string | null {
  const v = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (v.length < 3 || v.length > 10) return null;
  return v;
}

/** Slugs for `route:` token → workbench `routeAction` query (must match `CT_URL_ROUTE_ACTION_PREFIXES`). */
function resolveRouteActionSlug(raw: string): string | undefined {
  const slug = raw.trim().toLowerCase().replace(/-/g, "_");
  const map: Record<string, string> = {
    send: "Send booking",
    send_booking: "Send booking",
    await: "Await booking",
    await_booking: "Await booking",
    awaiting: "Await booking",
    escalate: "Escalate booking",
    escalate_booking: "Escalate booking",
    plan: "Plan leg",
    plan_leg: "Plan leg",
    departure: "Mark departure",
    mark_departure: "Mark departure",
    arrival: "Record arrival",
    record_arrival: "Record arrival",
    complete: "Route complete",
    route_complete: "Route complete",
  };
  const v = map[slug];
  if (v && CT_URL_ROUTE_ACTION_PREFIXES.has(v)) return v;
  return undefined;
}

/**
 * Lightweight R5 assistant: maps free text to structured filters + hints (rule-based core).
 * Optional OpenAI merge is applied in `assist-llm` when the deployment enables it.
 * Also returns a cleaned `q` for plain-text search after removing explicit tokens.
 */
export function assistControlTowerQuery(raw: string): {
  hints: string[];
  suggestedFilters: AssistSuggestedFilters;
} {
  let working = raw.trim();
  const hints: string[] = [];
  const suggestedFilters: AssistSuggestedFilters = {};

  if (!working) {
    hints.push(
      "Enter a PO number, booking ref, container id, carrier name, or UN/LOCODE-style port (e.g. CNSHA), or try lane:, origin:, dest:, route:plan_leg, source:po|unlinked, exception:CODE, alertType:TYPE, trace:SKU, product:CODE, owner:, carrier:, supplier:, customer:, and overdue tokens.",
    );
    return { hints, suggestedFilters };
  }

  const laneM =
    working.match(/\b(?:lane|pol|pod)\s*:\s*([A-Za-z0-9]{3,10})\b/i) ||
    working.match(/\b(?:from|to)\s+([A-Z]{2}[A-Z0-9]{3})\b/);
  if (laneM) {
    const v = laneM[1].trim().toUpperCase();
    if (v.length >= 3) {
      suggestedFilters.lane = v;
      hints.push(`Using lane / port token: ${v} (matches booking or leg UN/LOCODE-style codes).`);
      working = stripOnce(working, /\b(?:lane|pol|pod)\s*:\s*[A-Za-z0-9]{3,10}\b/i);
      working = stripOnce(working, /\b(?:from|to)\s+[A-Z]{2}[A-Z0-9]{3}\b/);
    }
  }

  const originTok = working.match(/\borigin\s*:\s*([A-Za-z0-9]{3,10})\b/i);
  if (originTok) {
    const v = normalizePortToken(originTok[1]);
    if (v) {
      suggestedFilters.originCode = v;
      hints.push(`Origin port filter (contains): ${v}.`);
    }
    working = stripOnce(working, /\borigin\s*:\s*[A-Za-z0-9]{3,10}\b/i);
  }

  const destTok =
    working.match(/\bdestination\s*:\s*([A-Za-z0-9]{3,10})\b/i) ||
    working.match(/\bdest\s*:\s*([A-Za-z0-9]{3,10})\b/i);
  if (destTok) {
    const v = normalizePortToken(destTok[1]);
    if (v) {
      suggestedFilters.destinationCode = v;
      hints.push(`Destination port filter (contains): ${v}.`);
    }
    working = stripOnce(working, /\bdestination\s*:\s*[A-Za-z0-9]{3,10}\b/i);
    working = stripOnce(working, /\bdest\s*:\s*[A-Za-z0-9]{3,10}\b/i);
  }

  const supplierM = working.match(/\bsupplier\s*:\s*(\S+)/i);
  if (supplierM) {
    const v = supplierM[1].trim();
    if (isProbableAssistCuid(v)) {
      suggestedFilters.supplierId = v;
      hints.push(`Using supplier id filter (${v.slice(0, 8)}…).`);
    } else {
      hints.push("supplier: expects a cuid-style id (from the supplier record).");
    }
    working = stripOnce(working, /\bsupplier\s*:\s*\S+/i);
  }

  const customerM = working.match(/\bcustomer\s*:\s*(\S+)/i);
  if (customerM) {
    const v = customerM[1].trim();
    if (isProbableAssistCuid(v)) {
      suggestedFilters.customerCrmAccountId = v;
      hints.push(`Using CRM customer id filter (${v.slice(0, 8)}…).`);
    } else {
      hints.push("customer: expects a cuid-style CRM account id.");
    }
    working = stripOnce(working, /\bcustomer\s*:\s*\S+/i);
  }

  const carrierM = working.match(/\bcarrier\s*:\s*(\S+)/i);
  if (carrierM) {
    const v = carrierM[1].trim();
    if (isProbableAssistCuid(v)) {
      suggestedFilters.carrierSupplierId = v;
      hints.push(`Using carrier supplier id filter (${v.slice(0, 8)}…).`);
    } else {
      hints.push("carrier: expects a cuid-style supplier id (carrier / forwarder record).");
    }
    working = stripOnce(working, /\bcarrier\s*:\s*\S+/i);
  }

  const dispatchOwnerM = working.match(/\b(?:owner|assignee|dispatch)\s*:\s*(\S+)/i);
  if (dispatchOwnerM) {
    const v = dispatchOwnerM[1].trim();
    if (isProbableAssistCuid(v)) {
      suggestedFilters.dispatchOwnerUserId = v;
      hints.push(`Dispatch owner filter on open queues (${v.slice(0, 8)}…).`);
    } else {
      hints.push("owner: / assignee: / dispatch: expects a cuid-style user id.");
    }
    working = stripOnce(working, /\b(?:owner|assignee|dispatch)\s*:\s*\S+/i);
  }

  const excM = working.match(/\b(?:exception|ex)\s*:\s*([\w.-]+)\b/i);
  if (excM) {
    const code = sanitizeListFilterToken(excM[1]);
    if (code) {
      suggestedFilters.exceptionCode = code;
      hints.push(`Open exception filter: ${code} (matches OPEN / IN_PROGRESS CtException.type).`);
    } else {
      hints.push("exception: / ex: expects a catalog-style code (letters, digits, . _ -).");
    }
    working = stripOnce(working, /\b(?:exception|ex)\s*:\s*[\w.-]+\b/i);
  }

  const alertTok =
    working.match(/\balertType\s*:\s*([\w.-]+)\b/i) || working.match(/\bctAlert\s*:\s*([\w.-]+)\b/i);
  if (alertTok) {
    const t = sanitizeListFilterToken(alertTok[1]);
    if (t) {
      suggestedFilters.alertType = t;
      hints.push(`Open alert filter: ${t} (matches OPEN / ACKNOWLEDGED CtAlert.type).`);
    } else {
      hints.push("alertType: / ctAlert: expects an alert type token (letters, digits, . _ -).");
    }
    working = stripOnce(working, /\balertType\s*:\s*[\w.-]+\b/i);
    working = stripOnce(working, /\bctAlert\s*:\s*[\w.-]+\b/i);
  }

  const traceM = working.match(/\b(?:trace|sku|product)\s*:\s*([\w.-]+)\b/i);
  if (traceM) {
    const t = sanitizeListFilterToken(traceM[1]);
    if (t) {
      suggestedFilters.productTraceQ = t;
      hints.push(`Product trace / SKU token: ${t}.`);
    } else {
      hints.push("trace: / sku: / product: expects a code (letters, digits, . _ -).");
    }
    working = stripOnce(working, /\b(?:trace|sku|product)\s*:\s*[\w.-]+\b/i);
  }

  const routeM = working.match(/\broute\s*:\s*([a-z0-9_-]+)\b/i);
  if (routeM) {
    const slug = routeM[1];
    const prefix = resolveRouteActionSlug(slug);
    if (prefix) {
      suggestedFilters.routeAction = prefix;
      hints.push(`Route action filter: ${prefix}.`);
    } else {
      hints.push(
        "route: expects a slug (e.g. plan_leg, send_booking, mark_departure, record_arrival, route_complete).",
      );
    }
    working = stripOnce(working, /\broute\s*:\s*[a-z0-9_-]+\b/i);
  }

  const shipSrcM = working.match(/\b(?:shipmentSource|source|flow)\s*:\s*(po|unlinked|export)\b/i);
  if (shipSrcM) {
    const raw = shipSrcM[1].toLowerCase();
    const v: "PO" | "UNLINKED" = raw === "po" ? "PO" : "UNLINKED";
    suggestedFilters.shipmentSource = v;
    hints.push(`Shipment flow filter: ${v === "PO" ? "PO-linked" : "Unlinked / export shell"}.`);
    working = stripOnce(working, /\b(?:shipmentSource|source|flow)\s*:\s*(?:po|unlinked|export)\b/i);
  }

  if (/\b(overdue|past\s*eta|late\s*eta|behind\s*schedule)\b/i.test(working)) {
    suggestedFilters.onlyOverdueEta = true;
    hints.push("Applying overdue-ETA filter (non-terminal shipments with ETA in the past).");
    working = stripOnce(working, /\b(overdue|past\s*eta|late\s*eta|behind\s*schedule)\b/gi);
  }

  for (const st of STATUS_WORDS) {
    const re = new RegExp(`\\b${st}\\b`, "i");
    if (re.test(working)) {
      suggestedFilters.status = st;
      hints.push(`Detected status ${st} — combined with text/lane filters in search.`);
      working = stripOnce(working, re);
      break;
    }
  }

  for (const { re, mode, label } of MODE_HINTS) {
    if (re.test(working)) {
      suggestedFilters.mode = mode;
      hints.push(`Detected ${label} — transport mode filter ${mode}.`);
      break;
    }
  }

  const isoContainer = working.match(/\b([A-Z]{4}\d{7})\b/);
  if (isoContainer) {
    hints.push(
      `ISO-style container token ${isoContainer[1]} — matches container numbers and general text.`,
    );
  }

  if (/\bBL\b|bill of lading|master|house/i.test(working)) {
    hints.push("B/L keywords match saved reference values on shipments (ctReferences).");
  }

  working = working.replace(/\s+/g, " ").trim();
  if (working.length > 0) {
    suggestedFilters.q = working;
  }
  if (suggestedFilters.productTraceQ && !suggestedFilters.q?.trim()) {
    suggestedFilters.q = suggestedFilters.productTraceQ;
  }

  if (hints.length === 0) {
    hints.push("Searching bookings, milestones, ASN, notes, containers, parties, orders, and forwarder names.");
  }

  return { hints, suggestedFilters };
}
