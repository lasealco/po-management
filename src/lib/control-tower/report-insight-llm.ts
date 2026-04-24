import type { CtRunReportResult } from "@/lib/control-tower/report-engine";
import { formatReportDateWindowLine, metricLabel } from "@/lib/control-tower/report-labels";

const MEASURE_LABELS: Record<string, string> = {
  shipments: "Shipments",
  volumeCbm: "Volume (cbm)",
  weightKg: "Weight (kg)",
  shippingSpend: "Shipping spend",
  onTimePct: "On-time %",
  avgDelayDays: "Avg delay (days)",
  openExceptions: "Open exceptions (count)",
  openExceptionRatePct: "Shipments with open exception %",
};

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Compact, bounded payload for the model — avoids sending huge tables. */
export function buildReportInsightContext(result: CtRunReportResult, question: string | null) {
  const m = result.config.measure;
  const measureLabel = MEASURE_LABELS[m] ?? m;
  const series = result.fullSeriesRows.length ? result.fullSeriesRows : result.rows;
  const top = series.slice(0, 25).map((r) => ({
    label: truncate(r.label, 80),
    value: Number(r.metrics[m] ?? 0),
  }));
  const cm = result.config.compareMeasure;
  const dateWindowLine = formatReportDateWindowLine({
    dateField: result.config.dateField,
    dateFrom: result.config.dateFrom,
    dateTo: result.config.dateTo,
  });
  return {
    title: result.config.title ?? null,
    dimension: result.config.dimension,
    measure: m,
    measureLabel,
    compareMeasure: cm,
    compareMeasureLabel: cm ? metricLabel(cm) : null,
    dateField: result.config.dateField,
    dateFrom: result.config.dateFrom,
    dateTo: result.config.dateTo,
    dateWindowLine,
    topN: result.config.topN,
    rowCount: result.rows.length,
    fullSeriesRowCount: result.fullSeriesRows.length,
    coverage: result.coverage,
    totals: result.totals,
    topRows: top,
    generatedAt: result.generatedAt,
    userQuestion: question?.trim() || null,
  };
}

export async function runReportInsightLlm(params: {
  result: CtRunReportResult;
  question: string | null;
}): Promise<{ insight: string } | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const enabled =
    process.env.CONTROL_TOWER_REPORT_INSIGHT_LLM === "1" ||
    (process.env.CONTROL_TOWER_REPORT_INSIGHT_LLM !== "0" && Boolean(apiKey));
  if (!apiKey || !enabled) {
    return { error: "Report insight is not enabled. Set OPENAI_API_KEY and CONTROL_TOWER_REPORT_INSIGHT_LLM=1." };
  }

  const model =
    process.env.OPENAI_REPORT_INSIGHT_MODEL?.trim() ||
    process.env.OPENAI_CONTROL_TOWER_ASSIST_MODEL?.trim() ||
    "gpt-4o-mini";

  const ctx = buildReportInsightContext(params.result, params.question);

  const system = [
    "You analyze operational shipment reports for logistics teams.",
    "You receive aggregated numeric data only (no raw PII).",
    "Write a concise insight in plain English: 3–6 short bullet points or one short paragraph.",
    "Call out top contributors, outliers, concentration risk, and trends if visible.",
    "If data is sparse or zeros dominate, say so and suggest what to filter or check next.",
    "Do not invent numbers; only interpret what is given.",
    "If the user asked a specific question, answer it first, then add brief context.",
    "When dateWindowLine is present, treat it as the report's date-field filter; do not assume a wider calendar range.",
  ].join(" ");

  const user = JSON.stringify(ctx);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 900,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { error: errText.slice(0, 200) || `OpenAI error HTTP ${res.status}` };
    }
    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const insight = payload.choices?.[0]?.message?.content?.trim() || "";
    if (!insight) return { error: "Empty response from model." };
    return { insight };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Insight request failed." };
  }
}
