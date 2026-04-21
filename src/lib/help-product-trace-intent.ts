/** Max length must stay aligned with `sanitizeProductTraceOpenPathQuery` in help-actions.ts. */
const MAX_PRODUCT_TRACE_Q = 64;

const EXCLUDED_TRACE_CODES = new Set(
  [
    "trace",
    "page",
    "help",
    "catalog",
    "manager",
    "management",
    "information",
    "details",
    "list",
    "map",
    "search",
    "tool",
    "tools",
    "settings",
    "report",
    "reports",
  ].map((s) => s.toLowerCase()),
);

function sanitizeTraceToken(raw: string): string | undefined {
  const m = raw.trim().match(/^([A-Za-z0-9._-]+)/);
  if (!m) return undefined;
  const t = m[1].slice(0, MAX_PRODUCT_TRACE_Q);
  if (t.length < 2) return undefined;
  if (EXCLUDED_TRACE_CODES.has(t.toLowerCase())) return undefined;
  return t;
}

/**
 * Best-effort parse of a SKU / buyer code / PKG-* token from natural language for Help → open_path `q`.
 * Conservative: prefers explicit phrases; rejects generic words after “product”.
 */
export function extractProductTraceOpenPathQueryFromUserMessage(message: string): string | undefined {
  const t = message.trim();
  if (!t) return undefined;

  const patterns: Array<{ re: RegExp; group: 0 | 1 }> = [
    { re: /\b(PKG-[A-Za-z0-9._-]+)\b/i, group: 1 },
    { re: /\bSKU\s*[#:]?\s*([A-Za-z0-9._-]{2,64})\b/i, group: 1 },
    /** `trace:CODE` or `trace:#CODE` (colon first, optional hash before code). */
    { re: /\btrace\s*:\s*#?\s*([A-Za-z0-9._-]{2,64})\b/i, group: 1 },
    {
      re: /\blooking\s+for\s+(?:a\s+|the\s+|an\s+)?(?:product|sku|item)\s+([A-Za-z0-9._-]{2,64})\b/i,
      group: 1,
    },
    {
      re: /\bfind\s+(?:my\s+|the\s+|a\s+|an\s+)?(?:product|sku|item)\s+([A-Za-z0-9._-]{2,64})\b/i,
      group: 1,
    },
    {
      re: /\b(?:where|show)\s+(?:is\s+|me\s+)?(?:my\s+|the\s+|a\s+|an\s+)?(?:product|sku|item)\s+([A-Za-z0-9._-]{2,64})\b/i,
      group: 1,
    },
    {
      re: /\btrack\s+(?:down\s+)?(?:my\s+|the\s+|a\s+|an\s+)?(?:product|sku|item)\s+([A-Za-z0-9._-]{2,64})\b/i,
      group: 1,
    },
  ];

  for (const { re, group } of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const raw = m[group] ?? m[0];
    if (typeof raw !== "string") continue;
    const sanitized = sanitizeTraceToken(raw);
    if (sanitized) return sanitized;
  }

  return undefined;
}
