import type { ReportingCockpitSnapshot } from "./cockpit-types";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildCockpitInsightContext(snapshot: ReportingCockpitSnapshot, question: string | null) {
  return {
    generatedAt: snapshot.generatedAt,
    currency: snapshot.currency,
    summary: snapshot.summary,
    headlineChange: snapshot.headlineChange,
    activityTrends: snapshot.activityTrends,
    topExceptions: snapshot.exceptions
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    cashCycle: snapshot.cashCycle.map((c) => ({
      label: truncate(c.label, 80),
      amount: Number(c.amount ?? 0),
      hint: truncate(c.hint, 120),
    })),
    recommendedActions: snapshot.recommendedActions,
    userQuestion: question?.trim() || null,
  };
}

export async function runCockpitInsightLlm(params: {
  snapshot: ReportingCockpitSnapshot;
  question: string | null;
}): Promise<{ insight: string } | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const enabled =
    process.env.REPORTING_COCKPIT_LLM === "1" ||
    (process.env.REPORTING_COCKPIT_LLM !== "0" && Boolean(apiKey));
  if (!apiKey || !enabled) {
    return { error: "Cockpit insight is not enabled. Set OPENAI_API_KEY and REPORTING_COCKPIT_LLM=1." };
  }

  const model =
    process.env.OPENAI_REPORTING_COCKPIT_MODEL?.trim() ||
    process.env.OPENAI_REPORT_INSIGHT_MODEL?.trim() ||
    "gpt-4o-mini";

  const context = buildCockpitInsightContext(params.snapshot, params.question);
  const system = [
    "You are an executive analytics copilot for supply chain and revenue operations.",
    "You receive aggregated metrics across PO, logistics, CRM, and WMS.",
    "Write concise insights in plain English (4-7 short bullet points).",
    "Prioritize risks and opportunities, and propose 2-3 concrete next checks/actions.",
    "If user asks a specific question, answer it first.",
    "Never invent metrics; only use provided values.",
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
        temperature: 0.25,
        max_tokens: 1000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(context) },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { error: errText.slice(0, 300) || `OpenAI error HTTP ${res.status}` };
    }
    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const insight = payload.choices?.[0]?.message?.content?.trim() || "";
    if (!insight) return { error: "Empty response from model." };
    return { insight };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Cockpit insight request failed." };
  }
}
