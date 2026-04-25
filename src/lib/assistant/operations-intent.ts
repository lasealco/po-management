import { extractProductTraceOpenPathQueryFromUserMessage } from "@/lib/help-product-trace-intent";
import { extractProductHints } from "@/lib/assistant/sales-order-intent";

const STRONG_OPS =
  /(how\s+(?:much|many)\s|how\s+much|how\s+many|stock|in stock|inventory|on hand|available (?:in|at)(?:\s+the)?\s+warehouses?|product trace|where (?:is|are)\s+(?:the\s+)?(?:my\s+)?(product|sku|item|pkg|lot)|\bdo we have\b|\bin transit\b|on the water|at\s+which\s+warehouse|warehouse\s+stock|any\s+stock|left in)/i;
const STRONG_SALES = /(wants?\s+to\s+(?:order|buy))|\b\d+\s*usd\b|\bper\s*piece|pickup|next week|customer called|send a truck|(?:^|\b)order\s+from\b/i;

/**
 * Heuristic: treat message as an inventory / trace / “where is it” question before sales-order flow.
 * Conservative when text looks like a live order request (prices, pickup, “customer called”) without ops words.
 */
export function isOperationsQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (STRONG_OPS.test(t)) {
    if (STRONG_SALES.test(t) && !/stock|inventory|on hand|how (?:much|many)\b|where (?:is|are)/i.test(t)) {
      return false;
    }
    return true;
  }
  if (STRONG_SALES.test(t) && !STRONG_OPS.test(t)) return false;

  const traceToken = extractProductTraceOpenPathQueryFromUserMessage(t);
  if (traceToken) {
    const wordCount = t.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 8 && !/wants?|per\s*piece|usd|pickup|customer called/i.test(t)) return true;
  }

  if (/\?/.test(t) && (/\b(warehouse|ship|in transit|trace|product)\b/i.test(t) || traceToken)) return true;

  return false;
}

/**
 * Best product search string: explicit trace/SKU, then heuristics (corr-roll, etc.), then first meaningful word.
 */
export function extractProductQueryHint(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const fromTrace = extractProductTraceOpenPathQueryFromUserMessage(t);
  if (fromTrace) return fromTrace;
  const hints = extractProductHints(t);
  if (hints.length) return hints[0] ?? "";
  const m = t.match(
    /(?:for|of)\s+([A-Za-z0-9][A-Za-z0-9._\-\s]{1,40}?)(?:\s+in\s+the\s+warehouse|\?|$|\.)/i,
  );
  if (m?.[1]) return m[1].replace(/\s+/g, " ").trim();
  return "";
}

export type ProductPick = { id: string; name: string; productCode: string | null; sku: string | null };
