import { createHash } from "node:crypto";

import { APIHUB_MAPPING_ANALYSIS_ENGINE_OPENAI } from "@/lib/apihub/constants";
import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";

const REDACT_KEY = /(secret|password|token|apikey|api_key|authorization|credential)/i;

function redactForLlm(value: unknown, depth: number): unknown {
  if (depth > 6) {
    return "[truncated-depth]";
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => redactForLlm(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEY.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactForLlm(v, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) {
    return `${value.slice(0, 2000)}…`;
  }
  return value;
}

export type ApiHubMappingLlmProposal = {
  schemaVersion: 1;
  engine: typeof APIHUB_MAPPING_ANALYSIS_ENGINE_OPENAI;
  rules: ApiHubMappingRule[];
  notes: string[];
};

export type ApiHubMappingLlmMeta = {
  attempted: boolean;
  used: boolean;
  model?: string;
  inputSha256?: string;
  error?: string;
};

function openAiApiKey(): string | null {
  const k = process.env.APIHUB_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

function openAiModel(): string {
  return process.env.APIHUB_OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

const MAPPING_PROPOSAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rules", "notes"],
  properties: {
    rules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourcePath", "targetField"],
        properties: {
          sourcePath: { type: "string" },
          targetField: { type: "string" },
          transform: {
            type: "string",
            enum: ["identity", "trim", "upper", "lower", "number", "iso_date", "boolean", "currency"],
          },
          required: { type: "boolean" },
        },
      },
    },
    notes: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

/**
 * Structured mapping proposal via OpenAI (no secrets in env beyond API key).
 * Returns null when no key is configured (caller should use heuristic).
 */
export async function proposeApiHubMappingWithOpenAi(input: {
  records: unknown[];
  targetFields: string[] | null;
}): Promise<
  | { ok: true; proposal: ApiHubMappingLlmProposal; meta: ApiHubMappingLlmMeta }
  | { ok: false; meta: ApiHubMappingLlmMeta }
> {
  const apiKey = openAiApiKey();
  const model = openAiModel();
  const baseMeta: ApiHubMappingLlmMeta = { attempted: Boolean(apiKey), used: false, model };

  if (!apiKey) {
    return { ok: false, meta: { ...baseMeta, attempted: false, error: "no_api_key" } };
  }

  const sample = input.records.slice(0, 18).map((r) => redactForLlm(r, 0));
  const payload = {
    records: sample,
    targetFieldHints: input.targetFields ?? [],
    instructions:
      "Propose field mapping rules. Use JSON sourcePath syntax compatible with dotted paths and numeric array indices (e.g. shipment.id or items[0].sku). Do not invent values; only map paths. Prefer concise targetField names (snake_case). If unsure about transform, use identity.",
  };
  const userJson = JSON.stringify(payload);
  if (userJson.length > 14_000) {
    return {
      ok: false,
      meta: { ...baseMeta, error: "payload_too_large_after_redaction" },
    };
  }

  const inputSha256 = createHash("sha256").update(userJson).digest("hex");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are an integration engineer. Output only JSON matching the schema. Never include credentials or fabricated business identifiers.",
          },
          { role: "user", content: userJson },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "apihub_mapping_proposal",
            strict: false,
            schema: MAPPING_PROPOSAL_JSON_SCHEMA,
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        meta: {
          ...baseMeta,
          error: `openai_http_${res.status}:${errText.slice(0, 200)}`,
        },
      };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (typeof raw !== "string") {
      return { ok: false, meta: { ...baseMeta, error: "empty_completion" } };
    }

    const parsed = JSON.parse(raw) as { rules?: unknown; notes?: unknown };
    if (!Array.isArray(parsed.rules)) {
      return { ok: false, meta: { ...baseMeta, error: "invalid_rules_shape" } };
    }

    const notes = Array.isArray(parsed.notes) ? parsed.notes.filter((n): n is string => typeof n === "string") : [];

    return {
      ok: true,
      proposal: {
        schemaVersion: 1,
        engine: APIHUB_MAPPING_ANALYSIS_ENGINE_OPENAI,
        rules: parsed.rules as ApiHubMappingRule[],
        notes: [
          ...notes,
          `LLM model ${model}; input payload sha256=${inputSha256.slice(0, 12)}…`,
        ],
      },
      meta: { ...baseMeta, used: true, inputSha256 },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "llm_error";
    return { ok: false, meta: { ...baseMeta, error: msg.slice(0, 300) } };
  }
}
