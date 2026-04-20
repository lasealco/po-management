import {
  sanitizeHelpDoActions,
  type HelpDoAction,
} from "@/lib/help-actions";
import { HELP_PLAYBOOKS, matchPlaybook, type HelpPlaybook } from "@/lib/help-playbooks";
import { LEGAL_COOKIES_PATH, LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from "@/lib/legal-public-paths";
import { MARKETING_PRICING_PATH, PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";

type HelpAction = { label: string; href: string };

export type HelpReply = {
  answer: string;
  playbook: HelpPlaybook | null;
  suggestions: string[];
  actions: HelpAction[];
  doActions: HelpDoAction[];
  /** True when OpenAI returned a structured reply (not rule-only fallback). */
  llmUsed: boolean;
};

const ROUTE_HINTS: HelpAction[] = [
  { label: "Platform hub", href: PLATFORM_HUB_PATH },
  { label: "Plans & pricing", href: MARKETING_PRICING_PATH },
  { label: "Open Orders", href: "/orders" },
  { label: "Open Consolidation", href: "/consolidation" },
  { label: "Open Suppliers", href: "/suppliers" },
  { label: "Open Users", href: "/settings/users" },
  { label: "Open Warehouses", href: "/settings/warehouses" },
  { label: "Control Tower home", href: "/control-tower" },
  { label: "Control Tower workbench", href: "/control-tower/workbench" },
  { label: "Control Tower reports", href: "/control-tower/reports" },
  { label: "Product trace", href: "/product-trace" },
  { label: "Reporting hub", href: "/reporting" },
  { label: "Login", href: "/login" },
  { label: "Privacy policy", href: LEGAL_PRIVACY_PATH },
  { label: "Terms of service", href: LEGAL_TERMS_PATH },
  { label: "Cookie policy", href: LEGAL_COOKIES_PATH },
];

function fallbackReply(message: string): HelpReply {
  const matched = matchPlaybook(message);
  if (matched) {
    const firstHref = matched.steps.find((s) => s.href)?.href;
    const doActions: HelpDoAction[] = [];
    if (matched.id === "create_order") {
      doActions.push({
        type: "open_order",
        label: "Open demo PO-1004",
        payload: { orderNumber: "PO-1004", focus: "workflow", guide: matched.id, step: 2 },
      });
      doActions.push({
        type: "open_orders_queue",
        label: "Show orders needing my action",
        payload: { queue: "needs_my_action", guide: matched.id, step: 0 },
      });
    }
    if (matched.id === "consolidation") {
      doActions.push({
        type: "open_path",
        label: "Open consolidation planner",
        payload: { path: "/consolidation", guide: matched.id, step: 0 },
      });
    }
    if (matched.id === "create_supplier") {
      doActions.push({
        type: "open_path",
        label: "Open suppliers",
        payload: { path: "/suppliers", guide: matched.id, step: 0 },
      });
    }
    if (matched.id === "user_admin") {
      doActions.push({
        type: "open_path",
        label: "Open user settings",
        payload: { path: "/settings/users", guide: matched.id, step: 0 },
      });
    }
    if (matched.id === "control_tower") {
      doActions.push({
        type: "open_path",
        label: "Open Control Tower reports",
        payload: { path: "/control-tower/reports", guide: matched.id, step: 2 },
      });
      doActions.push({
        type: "open_path",
        label: "Open workbench",
        payload: { path: "/control-tower/workbench", guide: matched.id, step: 1 },
      });
      doActions.push({
        type: "open_path",
        label: "Open shipment digest",
        payload: { path: "/control-tower/digest", guide: matched.id, step: 5 },
      });
    }
    if (matched.id === "reporting_hub") {
      doActions.push({
        type: "open_path",
        label: "Open Reporting hub",
        payload: { path: "/reporting", guide: matched.id, step: 0 },
      });
      doActions.push({
        type: "open_path",
        label: "Reporting hub — Control Tower section",
        payload: { path: "/reporting", focus: "control-tower", guide: matched.id, step: 0 },
      });
    }
    if (matched.id === "product_trace") {
      doActions.push({
        type: "open_path",
        label: "Open Product trace",
        payload: { path: "/product-trace", guide: matched.id, step: 0 },
      });
      doActions.push({
        type: "open_path",
        label: "Open demo SKU on map",
        payload: { path: "/product-trace", q: "PKG-CORR-ROLL", guide: matched.id, step: 1 },
      });
    }
    if (matched.id === "public_marketing") {
      doActions.push({
        type: "open_path",
        label: "Open plans & pricing",
        payload: { path: MARKETING_PRICING_PATH, guide: matched.id, step: 0 },
      });
      doActions.push({
        type: "open_path",
        label: "Open platform hub",
        payload: { path: PLATFORM_HUB_PATH, guide: matched.id, step: 1 },
      });
      doActions.push({
        type: "open_path",
        label: "Open privacy policy",
        payload: { path: LEGAL_PRIVACY_PATH, guide: matched.id, step: 2 },
      });
      doActions.push({
        type: "open_path",
        label: "Open terms of service",
        payload: { path: LEGAL_TERMS_PATH, guide: matched.id, step: 3 },
      });
      doActions.push({
        type: "open_path",
        label: "Open cookie policy",
        payload: { path: LEGAL_COOKIES_PATH, guide: matched.id, step: 4 },
      });
    }
    return {
      answer: `${matched.title}: ${matched.summary}`,
      playbook: matched,
      suggestions: [
        "Show me the next step",
        "Navigate me to the first page",
        "Explain common mistakes",
      ],
      actions: firstHref ? [{ label: "Start guide", href: firstHref }] : [],
      doActions,
      llmUsed: false,
    };
  }
  return {
    answer:
      "I can guide you through orders, suppliers, consolidation, Control Tower, product trace (SKU → map), the Reporting hub (cockpit, refresh shortcuts), and user administration. Privacy, terms, and cookies are on their own public pages (also in the command palette). Try asking: 'I want to create an order', 'How do I trace a SKU on the map?', or 'How do I build a consolidation load?'",
    playbook: null,
    suggestions: HELP_PLAYBOOKS.map((p) => p.title),
    actions: ROUTE_HINTS.slice(0, 4),
    doActions: [],
    llmUsed: false,
  };
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return null;
}

export async function buildHelpReply(params: {
  message: string;
  currentPath?: string;
}): Promise<HelpReply> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const llmDisabled = process.env.HELP_LLM === "0" || process.env.OPENAI_HELP_DISABLED === "1";
  if (!apiKey || llmDisabled) return fallbackReply(params.message);

  const matched = matchPlaybook(params.message);
  const playbookHint = matched
    ? `Matched playbook: ${matched.title} (${matched.id})`
    : "No exact playbook matched.";

  const system = [
    "You are an in-app onboarding assistant for a PO management system.",
    "Give concise, practical guidance in plain English.",
    "If user asks 'how do I do X', provide short answer plus actionable next click.",
    "Prefer existing routes only.",
    "Return a single JSON object only (no markdown) with keys: answer, suggestions, actions, doActions.",
    "actions is array of {label, href}. href must start with '/'.",
    "doActions is optional array of {type, label, payload} for one-click execution (server-validated).",
    "Allowed doActions types:",
    "- open_order: payload { orderNumber: string, focus?: 'workflow'|'asn'|'chat'|'split', guide?: playbook id, step?: number }",
    "- open_orders_queue: payload { queue: 'all'|'needs_my_action'|'waiting_on_me'|'awaiting_supplier'|'overdue'|'split_pending_buyer', guide?, step? }",
    "- open_path: payload { path: '…', guide?, step?, q?, focus? }",
    `Paths: '${PLATFORM_HUB_PATH}'|'${MARKETING_PRICING_PATH}'|'${LEGAL_PRIVACY_PATH}'|'${LEGAL_TERMS_PATH}'|'${LEGAL_COOKIES_PATH}'|'/orders'|'/consolidation'|'/suppliers'|'/settings/users'|'/settings/warehouses'|'/login'|'/catalog'|'/products'|'/product-trace'|'/reporting'|'/reports'|'/crm/reporting'|'/wms/reporting'|'/control-tower'|'/control-tower/workbench'|'/control-tower/digest'|'/control-tower/reports'|'/control-tower/search'|'/control-tower/dashboard'|'/control-tower/command-center'|'/control-tower/ops'.`,
    "For path '/product-trace' only, optional q is a SKU or product code (alphanumeric, dots, underscores, hyphens; max 64 chars).",
    "For path '/reporting' only, optional focus is 'po'|'control-tower'|'crm'|'wms' (scrolls the hub to that module card).",
    "Use demo PO-1004 only as a known example order number when suggesting open_order.",
    "Do not invent unavailable pages or arbitrary paths.",
    "Reporting hub (/reporting): Cockpit board supports Refresh data, optional Auto-refresh (5/10/15 min, pauses when the tab is hidden, catch-up when returning), R to refresh when focus is not in an input/textarea/select, Shift+R for silent refresh. Command palette lists the Reporting hub with the same shortcut hints.",
  ].join(" ");

  const user = JSON.stringify({
    message: params.message,
    currentPath: params.currentPath ?? null,
    availableRoutes: ROUTE_HINTS,
    playbookHint,
    reportingCockpitHints:
      "On /reporting: R = refresh snapshot (not while typing in a field). Shift+R = silent refresh. Auto-refresh checkbox + interval; status line shows last auto result (timer, returned to tab, or on enable).",
  });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_HELP_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return fallbackReply(params.message);
    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim() || "";
    const jsonSlice = extractJsonObject(text) ?? text;
    const parsed = safeJsonParse<{
      answer?: string;
      suggestions?: string[];
      actions?: Array<{ label?: string; href?: string }>;
      doActions?: unknown;
    }>(jsonSlice);
    if (!parsed?.answer) return fallbackReply(params.message);

    const actions = (parsed.actions ?? [])
      .filter((a) => a?.label && a?.href && a.href.startsWith("/"))
      .map((a) => ({ label: a.label!, href: a.href! }))
      .slice(0, 4);
    const doActions = sanitizeHelpDoActions(parsed.doActions);
    return {
      answer: parsed.answer,
      playbook: matched ?? null,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 5)
        : [],
      actions,
      doActions,
      llmUsed: true,
    };
  } catch {
    return fallbackReply(params.message);
  }
}
