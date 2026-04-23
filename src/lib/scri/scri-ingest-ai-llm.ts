import type { ScriIngestBody } from "@/lib/scri/schemas/ingest-body";
import { scriEventTypeLabel } from "@/lib/scri/event-type-taxonomy";

const URL_RE = /^https:\/\/.+/i;
const MAX_EXCERPT = 2800;
const MAX_OUT = 12_000;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** At least one source must carry an https URL so the model can ground on linked evidence (ingest contract). */
export function scriIngestSourcesHavePublicHttpsUrls(body: ScriIngestBody): boolean {
  return body.sources.some((s) => {
    const u = s.url?.trim() ?? "";
    return u.length > 0 && URL_RE.test(u);
  });
}

function buildUserPayload(body: ScriIngestBody) {
  const eventTypeLabel = scriEventTypeLabel(body.eventType);
  const sources = body.sources.map((s, i) => ({
    index: i + 1,
    sourceType: s.sourceType,
    publisher: s.publisher ?? null,
    headline: s.headline ?? null,
    url: s.url?.trim() || null,
    publishedAt: s.publishedAt ?? null,
    extractedText: s.extractedText ? truncate(s.extractedText, MAX_EXCERPT) : null,
    extractionConfidence: s.extractionConfidence ?? null,
  }));

  return {
    instruction:
      "Summarize only from this JSON. Every factual statement must trace to a field or to Source [n] below.",
    event: {
      ingestKey: body.ingestKey,
      eventType: body.eventType,
      eventTypeLabel,
      title: body.title,
      shortSummary: body.shortSummary ?? null,
      longSummary: body.longSummary ? truncate(body.longSummary, 4000) : null,
      severity: body.severity,
      confidence: body.confidence,
      sourceTrustScore: body.sourceTrustScore ?? null,
      eventTime: body.eventTime ?? null,
      geographies: body.geographies ?? [],
    },
    sources,
  };
}

/**
 * Grounded OpenAI summary for SCRI ingest. Only runs when OPENAI_API_KEY is set and SCRI_INGEST_AI_LLM is not "0".
 * Returns ok:false when disabled, no https URL on any source, or request fails (caller should fall back).
 */
export async function tryScriIngestAiLlm(
  body: ScriIngestBody,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const enabled =
    process.env.SCRI_INGEST_AI_LLM === "1" ||
    (process.env.SCRI_INGEST_AI_LLM !== "0" && Boolean(apiKey));
  if (!apiKey || !enabled) return { ok: false };

  if (!scriIngestSourcesHavePublicHttpsUrls(body)) return { ok: false };

  const model =
    process.env.OPENAI_SCRI_INGEST_MODEL?.trim() ||
    process.env.OPENAI_HELP_MODEL?.trim() ||
    "gpt-4o-mini";

  const user = JSON.stringify(buildUserPayload(body));

  const system = [
    "You assist supply chain risk analysts. You receive ONLY JSON from an authenticated ingest connector.",
    "Treat the JSON as the sole evidence. Do not use general knowledge to add facts, dates, locations, or casualty figures not present in the payload.",
    "The sources array is the only basis for attributing external reporting. When you state something that comes from a source, cite it as Source [n] and include its url field when present.",
    "If evidence is thin or contradictory, say what is missing or uncertain instead of filling gaps.",
    "Never claim confirmed purchase-order, shipment, inventory, or revenue impact; those are validated inside the product via separate matching.",
    "Output Markdown with these sections: ### Operator brief (short), ### What the provided sources support (bullets, each tied to Source [n] where applicable), ### Gaps and cautions.",
    "Keep the total response concise (under ~800 words). No preamble or 'As an AI'.",
  ].join(" ");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1600,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return { ok: false };

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const raw = payload.choices?.[0]?.message?.content?.trim() || "";
    if (!raw.length) return { ok: false };

    const text = raw.length > MAX_OUT ? `${raw.slice(0, MAX_OUT - 1)}…` : raw;
    return { ok: true, text };
  } catch {
    return { ok: false };
  }
}
