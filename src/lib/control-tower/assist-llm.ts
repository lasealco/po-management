import { assistControlTowerQuery, type AssistSuggestedFilters } from "@/lib/control-tower/assist";
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

async function fetchLlmAssistPatch(params: {
  raw: string;
  ruleHints: string[];
  ruleFilters: AssistSuggestedFilters;
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
    "suggestedFilters may include only these keys when you are confident: q, mode, status, onlyOverdueEta, shipperName, consigneeName, lane.",
    "mode must be one of: OCEAN, AIR, ROAD, RAIL.",
    "status must be one of: SHIPPED, VALIDATED, BOOKED, IN_TRANSIT, DELIVERED, RECEIVED.",
    "lane is a UN/LOCODE-style token (3–10 alphanumeric), uppercase.",
    "onlyOverdueEta is boolean true only when the user clearly wants late / past-ETA shipments.",
    "Do not invent shipper or consignee names; only set those if the user clearly named a party.",
    "If rule-based filters are already correct, return {} or only hints explaining the search.",
    "Prefer leaving q for residual free text; do not repeat structured tokens inside q.",
  ].join(" ");

  const user = JSON.stringify({
    userQuery: params.raw,
    ruleHints: params.ruleHints,
    ruleSuggestedFilters: params.ruleFilters,
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
export async function runControlTowerAssist(params: { raw: string }): Promise<ControlTowerAssistResult> {
  const rule = assistControlTowerQuery(params.raw);
  const capable = controlTowerAssistLlmCapable();

  if (!capable) {
    return {
      hints: rule.hints,
      suggestedFilters: rule.suggestedFilters,
      capabilities: { llmAssist: capable },
      usedLlm: false,
    };
  }

  try {
    const llmRaw = await fetchLlmAssistPatch({
      raw: params.raw,
      ruleHints: rule.hints,
      ruleFilters: rule.suggestedFilters,
    });
    if (!llmRaw) {
      return {
        hints: ["AI assist did not return usable JSON; using rule-based filters only.", ...rule.hints],
        suggestedFilters: rule.suggestedFilters,
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
    const mergedHints = [...cappedLlmHints, ...rule.hints].slice(0, 14);

    return {
      hints: mergedHints.length ? mergedHints : rule.hints,
      suggestedFilters: mergedFilters,
      capabilities: { llmAssist: true },
      usedLlm: true,
    };
  } catch {
    return {
      hints: ["AI assist failed; using rule-based filters only.", ...rule.hints],
      suggestedFilters: rule.suggestedFilters,
      capabilities: { llmAssist: true },
      usedLlm: false,
    };
  }
}
