import type { ShipmentStatus, TransportMode } from "@prisma/client";

/** Rule-based parse output for Search & assist (no LLM). */
export type AssistSuggestedFilters = {
  q?: string;
  mode?: TransportMode;
  status?: ShipmentStatus;
  onlyOverdueEta?: boolean;
  shipperName?: string;
  consigneeName?: string;
  lane?: string;
};

const STATUS_WORDS: ShipmentStatus[] = [
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

/**
 * Lightweight R5 assistant: maps free text to structured filters + hints (no LLM).
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
    hints.push("Enter a PO number, booking ref, container id, carrier, UN/LOCODE-style port (e.g. CNSHA), or try shipper:/consignee:/lane: tokens.");
    return { hints, suggestedFilters };
  }

  const shipperM = working.match(/\bshipper\s*:\s*([^\n,;]+?)(?=\s+(?:consignee|lane|status)\s*:|$)/i);
  if (shipperM) {
    const v = shipperM[1].trim();
    if (v) {
      suggestedFilters.shipperName = v;
      hints.push(`Using shipper filter: "${v}".`);
      working = stripOnce(working, /\bshipper\s*:\s*[^\n,;]+/i);
    }
  }

  const consigneeM = working.match(/\bconsignee\s*:\s*([^\n,;]+?)(?=\s+(?:shipper|lane|status)\s*:|$)/i);
  if (consigneeM) {
    const v = consigneeM[1].trim();
    if (v) {
      suggestedFilters.consigneeName = v;
      hints.push(`Using consignee filter: "${v}".`);
      working = stripOnce(working, /\bconsignee\s*:\s*[^\n,;]+/i);
    }
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

  if (hints.length === 0) {
    hints.push("Searching bookings, milestones, ASN, notes, containers, parties, orders, and forwarder names.");
  }

  return { hints, suggestedFilters };
}
