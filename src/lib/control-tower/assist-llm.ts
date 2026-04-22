import { assistControlTowerQuery, type AssistSuggestedFilters } from "@/lib/control-tower/assist";
import { retrieveAssistSnippets } from "@/lib/control-tower/assist-retrieval";
import { mergeAssistSuggestedFilters, sanitizeAssistSuggestedFilters } from "@/lib/control-tower/assist-sanitize";

export type ControlTowerAssistCapabilities = {
  llmAssist: boolean;
};

export type ControlTowerAssistResult = {
  hints: string[];
  suggestedFilters: AssistSuggestedFilters;
  capabilities: ControlTowerAssistCapabilities;
  usedLlm: boolean;
};

function isControlTowerAssistLlmEnabled(): boolean {
  const v = process.env.CONTROL_TOWER_ASSIST_LLM?.trim().toLowerCase();
  if (!v || v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}

export function controlTowerAssistLlmCapable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim() && isControlTowerAssistLlmEnabled());
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type LlmAssistPayload = {
  hints?: string[];
  suggestedFilters?: AssistSuggestedFilters;
};

export type AssistSavedReportBrief = {
  name: string;
  /** True when the row is `isShared` and owned by another user (tenant-wide shared). */
  shared: boolean;
  /** True when this user created the saved report. */
  mine: boolean;
};

export type AssistSavedWorkbenchFilterBrief = {
  name: string;
};

function hasAssistStructuredTokens(raw: string): boolean {
  return /\b(?:lane|origin|dest|destination|trace|product|sku|route|supplier|carrier|customer|source|flow|owner|assignee|dispatch|exception|ex|alertType|ctAlert):\s*\S/i.test(
    raw.trim(),
  );
}

/** Rule-based nudge when free text looks like a saved workbench filter name. */
export function savedWorkbenchFilterAssistHints(raw: string, brief: AssistSavedWorkbenchFilterBrief[]): string[] {
  const rawTrim = raw.trim();
  if (hasAssistStructuredTokens(rawTrim)) return [];
  const t = rawTrim.toLowerCase();
  if (t.length < 2 || brief.length === 0) return [];
  const hits = brief.filter((r) => {
    const n = r.name.trim().toLowerCase();
    if (!n) return false;
    return n.includes(t) || (t.length >= 3 && t.includes(n.slice(0, Math.min(12, n.length))));
  });
  if (hits.length === 1) {
    return [
      `Your text resembles saved workbench view “${hits[0].name}”. This page still runs **shipment text search** — open **Control Tower → Workbench** and pick that saved filter, or use lane:/status: tokens here.`,
    ];
  }
  if (hits.length > 1) {
    return [
      `Several saved workbench views match (“${hits
        .slice(0, 3)
        .map((h) => h.name)
        .join("”, “")}”). Narrow the query or open **Workbench** to choose one.`,
    ];
  }
  return [];
}

/** Rule-based nudge when free text looks like a saved report title (shipment search stays separate). */
export function savedReportAssistHints(raw: string, brief: AssistSavedReportBrief[]): string[] {
  const rawTrim = raw.trim();
  if (hasAssistStructuredTokens(rawTrim)) {
    return [];
  }
  const t = rawTrim.toLowerCase();
  if (t.length < 2 || brief.length === 0) return [];
  const hits = brief.filter((r) => {
    const n = r.name.trim().toLowerCase();
    if (!n) return false;
    return n.includes(t) || (t.length >= 3 && t.includes(n.slice(0, Math.min(12, n.length))));
  });
  if (hits.length === 1) {
    return [
      `Your text resembles saved report “${hits[0].name}”. This page searches **shipments** — open **Control Tower → Reports** to run that chart, or keep using lane:/status: tokens here.`,
    ];
  }
  if (hits.length > 1) {
    return [
      `Several saved reports match (“${hits
        .slice(0, 3)
        .map((h) => h.name)
        .join("”, “")}”). Narrow the query or open **Reports** to pick one.`,
    ];
  }
  return [];
}

async function fetchLlmAssistPatch(params: {
  raw: string;
  ruleHints: string[];
  ruleFilters: AssistSuggestedFilters;
  savedReportsBrief: AssistSavedReportBrief[];
  savedWorkbenchFiltersBrief: AssistSavedWorkbenchFilterBrief[];
  retrievedDocSnippets: string[];
}): Promise<LlmAssistPayload | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model =
    process.env.OPENAI_CONTROL_TOWER_ASSIST_MODEL?.trim() ||
    process.env.OPENAI_HELP_MODEL?.trim() ||
    "gpt-4o-mini";

  const system = [
    "You help operators search shipments in a Control Tower.",
    "You receive the user's raw query and rule-based parser output.",
    "Return JSON only with optional keys: hints (string[], max 4 short items), suggestedFilters (object).",
    "suggestedFilters may include only these keys when you are confident: q, mode, status, onlyOverdueEta, shipperName, consigneeName, lane, originCode, destinationCode, routeAction, shipmentSource, dispatchOwnerUserId, supplierId, customerCrmAccountId, carrierSupplierId, productTraceQ, exceptionCode, alertType.",
    "exceptionCode is a tenant catalog-style exception type string matching CtException.type on OPEN / IN_PROGRESS rows (not a cuid).",
    "alertType matches CtAlert.type on OPEN or ACKNOWLEDGED alerts (e.g. BOOKING_SLA_BREACHED, MANUAL).",
    "productTraceQ is a SKU or buyer product code when the user wants the Product trace map (PO → ocean → stock); use it only for product/SKU intent, not shipment ids.",
    "mode must be one of: OCEAN, AIR, ROAD, RAIL.",
    "status must be one of: SHIPPED, VALIDATED, BOOKED, IN_TRANSIT, DELIVERED, RECEIVED.",
    "lane, originCode, and destinationCode are UN/LOCODE-style tokens (3–10 alphanumeric), uppercase.",
    "routeAction must be exactly one of: Send booking, Await booking, Escalate booking, Plan leg, Mark departure, Record arrival, Route complete.",
    "shipmentSource must be PO or UNLINKED when the user clearly means PO-linked vs export/unlinked shell.",
    "supplierId, customerCrmAccountId, carrierSupplierId, and dispatchOwnerUserId must be cuid-style ids only when the user clearly pasted an id.",
    "onlyOverdueEta is boolean true only when the user clearly wants late / past-ETA shipments.",
    "Do not invent shipper or consignee names; only set those if the user clearly named a party.",
    "If rule-based filters are already correct, return {} or only hints explaining the search.",
    "Prefer leaving q for residual free text; do not repeat structured tokens inside q.",
    "You may receive savedControlTowerReports (name, shared, mine). Use only to write hints — never add unknown keys to suggestedFilters.",
    "If the query clearly references one saved report by name, hint to open Control Tower → Reports to run it; shipment search filters stay separate.",
    "You may receive savedWorkbenchFilterNames ({ name } only). Use only for hints — suggest Workbench to apply a saved view; never put view names into suggestedFilters.",
    "You may receive retrievedDocSnippets (short internal notes from keyword retrieval). Use only to improve hint wording and disambiguation; never invent shipment ids, cuids, or secrets. Do not add suggestedFilters keys that contradict ruleSuggestedFilters unless the user query clearly overrides.",
  ].join(" ");

  const user = JSON.stringify({
    userQuery: params.raw,
    ruleHints: params.ruleHints,
    ruleSuggestedFilters: params.ruleFilters,
    savedControlTowerReports: params.savedReportsBrief,
    savedWorkbenchFilterNames: params.savedWorkbenchFiltersBrief,
    ...(params.retrievedDocSnippets.length
      ? { retrievedDocSnippets: params.retrievedDocSnippets }
      : {}),
  });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) return null;
  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim() || "";
  const parsed = safeJsonParse<LlmAssistPayload>(text);
  if (!parsed || typeof parsed !== "object") return null;
  return parsed;
}

/**
 * Rule-based assist first; merges an OpenAI JSON patch when the deployment is LLM-capable (env-gated).
 */
export async function runControlTowerAssist(params: {
  raw: string;
  /** Optional: recent saved CT reports for this user (names only in LLM). */
  savedReportsBrief?: AssistSavedReportBrief[];
  /** Optional: this user's saved workbench filter names (names only in LLM). */
  savedWorkbenchFiltersBrief?: AssistSavedWorkbenchFilterBrief[];
}): Promise<ControlTowerAssistResult> {
  const reportBrief = params.savedReportsBrief ?? [];
  const filterBrief = params.savedWorkbenchFiltersBrief ?? [];
  const rule = assistControlTowerQuery(params.raw);
  const filterHints = savedWorkbenchFilterAssistHints(params.raw, filterBrief);
  const reportHints = savedReportAssistHints(params.raw, reportBrief);
  const retrieval = retrieveAssistSnippets(params.raw, { maxHints: 2, maxLlmDetails: 2, minScore: 1 });
  const prefix = [...filterHints, ...reportHints, ...retrieval.hintLines];
  const baseHints = prefix.length ? [...prefix, ...rule.hints] : rule.hints;
  const capable = controlTowerAssistLlmCapable();

  if (!capable) {
    return {
      hints: baseHints,
      suggestedFilters: sanitizeAssistSuggestedFilters(rule.suggestedFilters),
      capabilities: { llmAssist: capable },
      usedLlm: false,
    };
  }

  try {
    const llmRaw = await fetchLlmAssistPatch({
      raw: params.raw,
      ruleHints: baseHints,
      ruleFilters: rule.suggestedFilters,
      savedReportsBrief: reportBrief,
      savedWorkbenchFiltersBrief: filterBrief,
      retrievedDocSnippets: retrieval.llmDetails,
    });
    if (!llmRaw) {
      return {
        hints: ["AI assist did not return usable JSON; using rule-based filters only.", ...baseHints],
        suggestedFilters: sanitizeAssistSuggestedFilters(rule.suggestedFilters),
        capabilities: { llmAssist: true },
        usedLlm: false,
      };
    }

    const patch = sanitizeAssistSuggestedFilters(llmRaw.suggestedFilters ?? {});
    const mergedFilters = mergeAssistSuggestedFilters(rule.suggestedFilters, patch);
    const llmHints = Array.isArray(llmRaw.hints)
      ? llmRaw.hints.filter((h): h is string => typeof h === "string").map((h) => h.trim()).filter(Boolean)
      : [];
    const cappedLlmHints = llmHints.slice(0, 4);
    const mergedHints = [...cappedLlmHints, ...baseHints].slice(0, 14);

    return {
      hints: mergedHints.length ? mergedHints : baseHints,
      suggestedFilters: sanitizeAssistSuggestedFilters(mergedFilters),
      capabilities: { llmAssist: true },
      usedLlm: true,
    };
  } catch {
    return {
      hints: ["AI assist failed; using rule-based filters only.", ...baseHints],
      suggestedFilters: sanitizeAssistSuggestedFilters(rule.suggestedFilters),
      capabilities: { llmAssist: true },
      usedLlm: false,
    };
  }
}
