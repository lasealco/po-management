import type { TwinRiskSeverity } from "@prisma/client";

import type { ScriIngestBody } from "@/lib/scri/schemas/ingest-body";
import { scriEventTypeLabel } from "@/lib/scri/event-type-taxonomy";
import { tryScriIngestAiLlm } from "@/lib/scri/scri-ingest-ai-llm";

const MAX_LEN = 4500;

type BuilderInput = Pick<
  ScriIngestBody,
  "title" | "shortSummary" | "longSummary" | "eventType" | "severity" | "confidence" | "sources"
> & {
  eventTypeLabel: string;
  geographies: NonNullable<ScriIngestBody["geographies"]>;
};

function severityLine(severity: TwinRiskSeverity): string {
  return `Recorded severity is **${severity}**. Use it to prioritize alongside internal exposure (R2), not as standalone proof of business impact.`;
}

function interpretationHeuristic(eventType: string, severity: TwinRiskSeverity): string {
  const label = scriEventTypeLabel(eventType);
  if (severity === "INFO") {
    return `**${label}** is recorded at informational severity — useful for awareness; escalate if R2 exposure or triage changes priority.`;
  }
  if (severity === "CRITICAL" || severity === "HIGH") {
    return `Events typed as **${label}** at elevated severity often warrant fast owner review, validating carriers and suppliers on affected lanes, and confirming inventory or order commitments that touch the geography below.`;
  }
  if (severity === "MEDIUM") {
    return `For **${label}** at medium severity, a typical next step is to confirm whether active bookings or inbound flows touch the geography and whether mitigation (reroute, buffer stock, or supplier check-in) is needed.`;
  }
  return `For **${label}** at lower declared severity, monitoring may be enough until internal exposure (R2) or triage raises priority.`;
}

/**
 * Template summary from ingest fields only (no LLM). Does not invent internal matches.
 * Aligns with docs/SCRI AI spec guardrails: facts vs interpretation separated.
 */
export function buildDeterministicScriAiSummary(input: BuilderInput): string | null {
  const lines: string[] = [];

  lines.push("### Known facts (from ingest)");
  lines.push(`- **Title:** ${input.title}`);
  lines.push(`- **Type:** ${input.eventTypeLabel} (\`${input.eventType}\`)`);
  lines.push(`- **Classification confidence (ingest):** ${input.confidence}%`);
  lines.push(`- ${severityLine(input.severity)}`);

  if (input.shortSummary?.trim()) {
    lines.push(`- **Short narrative:** ${input.shortSummary.trim()}`);
  }
  if (input.longSummary?.trim()) {
    const clipped =
      input.longSummary.trim().length > 1200
        ? `${input.longSummary.trim().slice(0, 1200)}…`
        : input.longSummary.trim();
    lines.push(`- **Long narrative (trimmed):** ${clipped}`);
  }

  if (input.geographies.length) {
    const geoBits = input.geographies.map((g) =>
      [g.label, g.portUnloc, g.region, g.countryCode].filter(Boolean).join(" · ") || "—",
    );
    lines.push(`- **Geographies:** ${geoBits.join("; ")}`);
  }

  const sourceLines = input.sources
    .map((s) => {
      const bits = [s.sourceType, s.publisher, s.headline].filter(Boolean).join(" — ");
      return bits || s.sourceType;
    })
    .filter(Boolean);
  if (sourceLines.length) {
    lines.push(`- **Sources (${sourceLines.length}):** ${sourceLines.join(" | ")}`);
  }

  lines.push("");
  lines.push("### Interpretation (heuristic, not an LLM)");
  lines.push(interpretationHeuristic(input.eventType, input.severity));
  lines.push("");
  lines.push(
    "*This section is generated only from the fields above. It does not fabricate shipments, POs, or inventory links. Confirm internal exposure using **Run network match** and primary sources.*",
  );

  const text = lines.join("\n").trim();
  if (!text.length) return null;
  return text.length > MAX_LEN ? `${text.slice(0, MAX_LEN)}…` : text;
}

export type ScriConnectorAiResolution =
  | { kind: "connector"; aiSummary: string | null; aiSummarySource: string | null }
  | { kind: "auto" };

/** Explicit connector / clear overrides only. `auto` means LLM or deterministic template. */
export function resolveConnectorIngestAi(body: ScriIngestBody): ScriConnectorAiResolution {
  if (body.aiSummary === null) {
    return { kind: "connector", aiSummary: null, aiSummarySource: null };
  }
  if (body.aiSummary !== undefined) {
    const t = body.aiSummary.trim();
    if (!t.length) {
      return { kind: "connector", aiSummary: null, aiSummarySource: null };
    }
    return { kind: "connector", aiSummary: t, aiSummarySource: "CONNECTOR" };
  }
  return { kind: "auto" };
}

function resolveAutoIngestAiFields(body: ScriIngestBody): {
  aiSummary: string | null;
  aiSummarySource: string | null;
} {
  const built = buildDeterministicScriAiSummary({
    title: body.title,
    shortSummary: body.shortSummary ?? null,
    longSummary: body.longSummary ?? null,
    eventType: body.eventType,
    eventTypeLabel: scriEventTypeLabel(body.eventType),
    severity: body.severity,
    confidence: body.confidence,
    geographies: body.geographies ?? [],
    sources: body.sources,
  });
  if (!built) return { aiSummary: null, aiSummarySource: null };
  return { aiSummary: built, aiSummarySource: "DETERMINISTIC_V1" };
}

export function resolveIngestAiFields(body: ScriIngestBody): {
  aiSummary: string | null;
  aiSummarySource: string | null;
} {
  const c = resolveConnectorIngestAi(body);
  if (c.kind === "connector") {
    return { aiSummary: c.aiSummary, aiSummarySource: c.aiSummarySource };
  }
  return resolveAutoIngestAiFields(body);
}

/**
 * When `aiSummary` is omitted, tries OpenAI (if enabled and sources include https URLs), else deterministic template.
 */
export async function resolveIngestAiFieldsAsync(body: ScriIngestBody): Promise<{
  aiSummary: string | null;
  aiSummarySource: string | null;
}> {
  const c = resolveConnectorIngestAi(body);
  if (c.kind === "connector") {
    return { aiSummary: c.aiSummary, aiSummarySource: c.aiSummarySource };
  }

  const llm = await tryScriIngestAiLlm(body);
  if (llm.ok) {
    return { aiSummary: llm.text, aiSummarySource: "OPENAI_GROUNDED_V1" };
  }

  return resolveAutoIngestAiFields(body);
}
