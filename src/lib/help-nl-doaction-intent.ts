const ORDERS_QUEUE_VALUES = new Set([
  "all",
  "needs_my_action",
  "waiting_on_me",
  "awaiting_supplier",
  "overdue",
  "split_pending_buyer",
]);

const REPORTING_FOCUS = new Set(["po", "control-tower", "crm", "wms"]);

/**
 * Best-effort PO number for Help → `open_order` (server still resolves tenant + portal rules).
 * Prefers explicit `PO-1234` / `po 1234` style tokens.
 */
export function extractPurchaseOrderNumberFromUserMessage(message: string): string | undefined {
  const t = message.trim();
  if (!t) return undefined;
  const m = t.match(/\bPO[-\s]?(\d{3,8})\b/i);
  if (m?.[1]) return `PO-${m[1]}`;
  const m2 = t.match(/\bpurchase\s+order\s+#?\s*(\d{3,8})\b/i);
  if (m2?.[1]) return `PO-${m2[1]}`;
  return undefined;
}

/**
 * Maps natural phrases to an `open_orders_queue` `queue` value (see help-actions QUEUE_FILTERS).
 */
export function extractOrdersQueueIntentFromUserMessage(message: string): string | undefined {
  const q = message.toLowerCase();
  if (/\boverdue\b/.test(q)) return "overdue";
  if (/(needs?\s+my\s+action|my\s+action\s+queue|queue.*needs?\s+my\s+action)/.test(q)) return "needs_my_action";
  if (/(waiting\s+on\s+me|waiting\s+for\s+me)/.test(q)) return "waiting_on_me";
  if (/(awaiting\s+supplier|waiting\s+on\s+supplier)/.test(q)) return "awaiting_supplier";
  if (/(split\s+pending|pending\s+buyer\s+split)/.test(q)) return "split_pending_buyer";
  if (/\b(all\s+orders|orders\s+board|full\s+orders\s+list)\b/.test(q)) return "all";
  return undefined;
}

export type ReportingHubFocus = "po" | "control-tower" | "crm" | "wms";

/**
 * Infers `/reporting?focus=` when the user names a reporting hub section (narrow; requires reporting context).
 */
export function extractReportingHubFocusFromUserMessage(message: string): ReportingHubFocus | undefined {
  const q = message.toLowerCase();
  const reportingCtx =
    q.includes("reporting hub") ||
    q.includes("reporting cockpit") ||
    q.includes("/reporting") ||
    (q.includes("reporting") && q.includes("hub")) ||
    (q.includes("reporting") && q.includes("focus"));
  if (!reportingCtx) return undefined;
  if (/(control\s*tower|shipment).*(reporting|hub)|reporting.*(control\s*tower|ct\b)/.test(q)) return "control-tower";
  if (/(crm).*(reporting|hub)|reporting.*\bcrm\b/.test(q)) return "crm";
  if (/(wms).*(reporting|hub)|reporting.*\bwms\b/.test(q)) return "wms";
  if (/(^|\b)(po|purchase\s+order|procurement)(\b|\s).*(reporting|hub)|reporting.*\bpo\b/.test(q)) return "po";
  return undefined;
}

export function isValidOrdersQueueValue(v: string): boolean {
  return ORDERS_QUEUE_VALUES.has(v);
}

export function isValidReportingFocusValue(v: string): v is ReportingHubFocus {
  return REPORTING_FOCUS.has(v as ReportingHubFocus);
}
