import {
  sanitizeHelpDoActions,
  type HelpDoAction,
} from "@/lib/help-actions";
import { HELP_PLAYBOOKS, matchPlaybook, type HelpPlaybook } from "@/lib/help-playbooks";
import {
  filterHelpDoActionsByGrants,
  filterRouteHintsForGrants,
  type HelpAssistantGrantSnapshot,
  helpAssistantOpenPathAllowed,
  helpAssistantReportingFocusAllowed,
} from "@/lib/help-assistant-grants";
import {
  extractOrdersQueueIntentFromUserMessage,
  extractPurchaseOrderNumberFromUserMessage,
  extractReportingHubFocusFromUserMessage,
  isValidOrdersQueueValue,
} from "@/lib/help-nl-doaction-intent";
import { extractProductTraceOpenPathQueryFromUserMessage } from "@/lib/help-product-trace-intent";
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

function applyGrantFilteringToReply(
  reply: HelpReply,
  grantSnapshot: HelpAssistantGrantSnapshot | null | undefined,
): HelpReply {
  if (!grantSnapshot) return reply;
  return {
    ...reply,
    actions: reply.actions.filter((a) =>
      helpAssistantOpenPathAllowed(a.href.split("?")[0] ?? a.href, grantSnapshot),
    ),
    doActions: filterHelpDoActionsByGrants(reply.doActions, grantSnapshot),
  };
}

function fallbackReply(
  message: string,
  grantSnapshot?: HelpAssistantGrantSnapshot | null,
): HelpReply {
  const matched = matchPlaybook(message);
  if (matched) {
    const firstHref = matched.steps.find((s) => s.href)?.href;
    const doActions: HelpDoAction[] = [];
    if (matched.id === "create_order") {
      const extractedPo = extractPurchaseOrderNumberFromUserMessage(message);
      if (extractedPo && extractedPo.toUpperCase() !== "PO-1004") {
        doActions.push({
          type: "open_order",
          label: `Open ${extractedPo}`,
          payload: { orderNumber: extractedPo, focus: "workflow", guide: matched.id, step: 2 },
        });
      }
      const queueIntent = extractOrdersQueueIntentFromUserMessage(message);
      const queueVal =
        queueIntent && isValidOrdersQueueValue(queueIntent) ? queueIntent : null;
      if (queueVal && queueVal !== "needs_my_action") {
        doActions.push({
          type: "open_orders_queue",
          label: `Orders: ${queueVal.replace(/_/g, " ")}`,
          payload: { queue: queueVal, guide: matched.id, step: 0 },
        });
      }
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
      const rf = extractReportingHubFocusFromUserMessage(message);
      if (
        rf &&
        rf !== "control-tower" &&
        grantSnapshot &&
        helpAssistantReportingFocusAllowed(rf, grantSnapshot)
      ) {
        doActions.push({
          type: "open_path",
          label: `Reporting hub — ${rf}`,
          payload: { path: "/reporting", focus: rf, guide: matched.id, step: 0 },
        });
      }
    }
    if (matched.id === "product_trace") {
      const extracted = extractProductTraceOpenPathQueryFromUserMessage(message);
      if (extracted) {
        doActions.push({
          type: "open_path",
          label: `Open product trace for ${extracted}`,
          payload: { path: "/product-trace", q: extracted, guide: matched.id, step: 1 },
        });
      }
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
    const startGuide =
      firstHref &&
      (!grantSnapshot ||
        helpAssistantOpenPathAllowed(firstHref.split("?")[0] ?? firstHref, grantSnapshot))
        ? [{ label: "Start guide", href: firstHref }]
        : [];

    return applyGrantFilteringToReply(
      {
        answer: `${matched.title}: ${matched.summary}`,
        playbook: matched,
        suggestions: [
          "Show me the next step",
          "Navigate me to the first page",
          "Explain common mistakes",
        ],
        actions: startGuide,
        doActions,
        llmUsed: false,
      },
      grantSnapshot,
    );
  }
  const defaultActions = grantSnapshot
    ? filterRouteHintsForGrants(ROUTE_HINTS, grantSnapshot).slice(0, 4)
    : ROUTE_HINTS.slice(0, 4);
  return applyGrantFilteringToReply(
    {
      answer:
        "I can guide you through orders, suppliers, consolidation, Control Tower, product trace (SKU → map), the Reporting hub (cockpit, refresh shortcuts), and user administration. Privacy, terms, and cookies are on their own public pages (also in the command palette). Try asking: 'I want to create an order', 'I am looking for product corr-roll', 'How do I trace a SKU on the map?', or 'How do I build a consolidation load?'",
      playbook: null,
      suggestions: HELP_PLAYBOOKS.map((p) => p.title),
      actions: defaultActions,
      doActions: [],
      llmUsed: false,
    },
    grantSnapshot,
  );
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
  grantSnapshot?: HelpAssistantGrantSnapshot | null;
}): Promise<HelpReply> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const llmDisabled = process.env.HELP_LLM === "0" || process.env.OPENAI_HELP_DISABLED === "1";
  if (!apiKey || llmDisabled) return fallbackReply(params.message, params.grantSnapshot);

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
    "For path '/product-trace' only, optional q is a SKU or buyer-style product code (alphanumeric, dots, underscores, hyphens; max 64 chars). If the user names a product or SKU, include open_path with path '/product-trace' and payload.q so one click opens trace with search prefilled.",
    "Routing heuristics: PO/order workflow and consolidation → /orders or /consolidation; sales-side lists → /sales-orders; 'where is this SKU/product' → /product-trace?q=…; shipments, lanes, digest, shipment analytics → Control Tower paths; cross-module metrics cockpit → /reporting; PO-only saved reports → /reports.",
    "Control Tower: /control-tower/workbench for shipment lists; /control-tower/digest for a capped digest; /control-tower/search for search & assist (structured filters; optional LLM assist when enabled).",
    "Rates & Audit: Tariffs = contracts/rating/import; Pricing snapshots = frozen booking economics JSON; Invoice audit = carrier intakes compared to snapshots; RFQ = quote requests. Do not conflate snapshot library with invoice intakes.",
    "Demo truthfulness: map positions and some flows may be simulated for demos—do not claim live carrier GPS or production integrations unless the user explicitly describes that environment.",
    "Access: if the user seems blocked (empty data, denied), mention choosing an active demo user via Settings → Demo session (/settings/demo) when relevant.",
    "Power users: suggest the command palette (⌘K / Ctrl+K) for quick navigation when appropriate.",
    "When currentPath is provided in the user JSON, prefer next clicks inside that module unless the question clearly belongs elsewhere.",
    "For path '/reporting' only, optional focus is 'po'|'control-tower'|'crm'|'wms' (scrolls the hub to that module card).",
    "Use demo PO-1004 only as a known example order number when suggesting open_order.",
    "Do not invent unavailable pages or arbitrary paths.",
    "Reporting hub (/reporting): Cockpit board supports Refresh data, optional Auto-refresh (5/10/15 min, pauses when the tab is hidden, catch-up when returning), R to refresh when focus is not in an input/textarea/select, Shift+R for silent refresh. Command palette lists the Reporting hub with the same shortcut hints.",
    "User JSON includes helpCapabilities: booleans plus supplierPortalRestricted, tenantSlug, roleHint (supplier_portal|internal|unsigned) for the active viewer. Only suggest actions and doActions for routes they are allowed to open; omit the rest. If signedIn is false, tell them to pick a demo user in Settings → Demo session.",
    "When supplierPortalRestricted is true, keep examples portal-safe (no consolidation shortcuts, no implying hidden buyer PO tools). When roleHint is supplier_portal, prefer shipment-scoped language.",
    "User JSON may include extractedPurchaseOrderNumber, extractedOrdersQueue, extractedReportingFocus — when ordersView/reportingHub and grants allow, mirror them with open_order, open_orders_queue, or open_path /reporting + focus.",
    "Few-shot JSON shape (adapt; use real extractedProductTraceCode when present): When ordersView is true and extractedProductTraceCode is a non-empty string, include doActions with type open_path, path /product-trace, payload.q equal to that code, guide product_trace, step 1, and label like Open product trace for <CODE>. Also set actions to include {label, href} where href is /product-trace?q=<CODE> (encode safely). Example assistant object fragment (ellipses mean you still add suggestions): {\"answer\":\"Here is product trace prefilled for that code.\",\"suggestions\":[\"Open orders\",\"How do I trace another SKU?\"],\"actions\":[{\"label\":\"Product trace\",\"href\":\"/product-trace?q=PKG-CORR-ROLL\"}],\"doActions\":[{\"type\":\"open_path\",\"label\":\"Open product trace for PKG-CORR-ROLL\",\"payload\":{\"path\":\"/product-trace\",\"q\":\"PKG-CORR-ROLL\",\"guide\":\"product_trace\",\"step\":1}}]} — replace PKG-CORR-ROLL with the user's extracted code when different.",
  ].join(" ");

  const extractedProductTraceCode = extractProductTraceOpenPathQueryFromUserMessage(params.message);
  const extractedPurchaseOrderNumber = extractPurchaseOrderNumberFromUserMessage(params.message);
  const extractedOrdersQueueRaw = extractOrdersQueueIntentFromUserMessage(params.message);
  const extractedOrdersQueue =
    extractedOrdersQueueRaw && isValidOrdersQueueValue(extractedOrdersQueueRaw)
      ? extractedOrdersQueueRaw
      : null;
  const extractedReportingFocus = extractReportingHubFocusFromUserMessage(params.message);

  const availableRoutes = params.grantSnapshot
    ? filterRouteHintsForGrants(ROUTE_HINTS, params.grantSnapshot)
    : ROUTE_HINTS;

  const user = JSON.stringify({
    message: params.message,
    currentPath: params.currentPath ?? null,
    availableRoutes,
    helpCapabilities: params.grantSnapshot ?? null,
    playbookHint,
    extractedProductTraceCode: extractedProductTraceCode ?? null,
    extractedPurchaseOrderNumber: extractedPurchaseOrderNumber ?? null,
    extractedOrdersQueue,
    extractedReportingFocus: extractedReportingFocus ?? null,
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
    if (!res.ok) return fallbackReply(params.message, params.grantSnapshot);
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
    if (!parsed?.answer) return fallbackReply(params.message, params.grantSnapshot);

    const actions = (parsed.actions ?? [])
      .filter((a) => a?.label && a?.href && a.href.startsWith("/"))
      .map((a) => ({ label: a.label!, href: a.href! }))
      .slice(0, 4);
    let doActions = sanitizeHelpDoActions(parsed.doActions);
    if (extractedProductTraceCode) {
      const hasTraceWithQ = doActions.some(
        (a) =>
          a.type === "open_path" &&
          (a.payload as Record<string, unknown> | undefined)?.path === "/product-trace" &&
          typeof (a.payload as Record<string, unknown> | undefined)?.q === "string",
      );
      if (!hasTraceWithQ) {
        const injected: HelpDoAction = {
          type: "open_path",
          label: `Open product trace for ${extractedProductTraceCode}`,
          payload: {
            path: "/product-trace",
            q: extractedProductTraceCode,
            guide: "product_trace",
            step: 1,
          },
        };
        doActions = [injected, ...doActions].slice(0, 4);
      }
    }
    const gSnap = params.grantSnapshot;
    if (gSnap) {
      if (
        gSnap.reportingHub &&
        extractedReportingFocus &&
        helpAssistantReportingFocusAllowed(extractedReportingFocus, gSnap)
      ) {
        const hasReportingFocus = doActions.some(
          (a) =>
            a.type === "open_path" &&
            (a.payload as Record<string, unknown> | undefined)?.path === "/reporting" &&
            String((a.payload as Record<string, unknown> | undefined)?.focus ?? "").toLowerCase() ===
              extractedReportingFocus,
        );
        if (!hasReportingFocus) {
          const inj: HelpDoAction = {
            type: "open_path",
            label: `Reporting hub — ${extractedReportingFocus}`,
            payload: {
              path: "/reporting",
              focus: extractedReportingFocus,
              guide: "reporting_hub",
              step: 0,
            },
          };
          doActions = [inj, ...doActions].slice(0, 4);
        }
      }
      if (gSnap.ordersView && extractedOrdersQueue) {
        const hasQueue = doActions.some(
          (a) =>
            a.type === "open_orders_queue" &&
            String((a.payload as Record<string, unknown> | undefined)?.queue ?? "") === extractedOrdersQueue,
        );
        if (!hasQueue) {
          const inj: HelpDoAction = {
            type: "open_orders_queue",
            label: `Orders: ${extractedOrdersQueue.replace(/_/g, " ")}`,
            payload: {
              queue: extractedOrdersQueue,
              guide: matched?.id === "create_order" ? "create_order" : undefined,
              step: 0,
            },
          };
          doActions = [inj, ...doActions].slice(0, 4);
        }
      }
      if (gSnap.ordersView && extractedPurchaseOrderNumber) {
        const poUpper = extractedPurchaseOrderNumber.toUpperCase();
        const hasOrder = doActions.some(
          (a) =>
            a.type === "open_order" &&
            String((a.payload as Record<string, unknown> | undefined)?.orderNumber ?? "").toUpperCase() === poUpper,
        );
        if (!hasOrder) {
          const inj: HelpDoAction = {
            type: "open_order",
            label: `Open ${extractedPurchaseOrderNumber}`,
            payload: {
              orderNumber: extractedPurchaseOrderNumber,
              focus: "workflow",
              guide: matched?.id === "create_order" ? "create_order" : undefined,
              step: 2,
            },
          };
          doActions = [inj, ...doActions].slice(0, 4);
        }
      }
    }
    if (params.grantSnapshot) {
      doActions = filterHelpDoActionsByGrants(doActions, params.grantSnapshot);
    }
    const grantSnap = params.grantSnapshot;
    const actionsFiltered = grantSnap
      ? actions.filter((a) => helpAssistantOpenPathAllowed(a.href.split("?")[0] ?? a.href, grantSnap))
      : actions;
    return {
      answer: parsed.answer,
      playbook: matched ?? null,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 5)
        : [],
      actions: actionsFiltered,
      doActions,
      llmUsed: true,
    };
  } catch {
    return fallbackReply(params.message, params.grantSnapshot);
  }
}
