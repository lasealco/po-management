import { describe, expect, it } from "vitest";

import {
  buildDeterministicScriAiSummary,
  resolveIngestAiFields,
} from "@/lib/scri/build-deterministic-ai-summary";
import { scriIngestBodySchema } from "@/lib/scri/schemas/ingest-body";

describe("buildDeterministicScriAiSummary", () => {
  it("includes facts and guardrail footer", () => {
    const body = scriIngestBodySchema.parse({
      ingestKey: "test-ai-sum",
      eventType: "PORT_CONGESTION",
      title: "Port delay",
      severity: "HIGH",
      confidence: 70,
      shortSummary: "Queues reported.",
      sources: [{ sourceType: "news", headline: "Terminal note" }],
      geographies: [{ countryCode: "CN", portUnloc: "CNSHA", label: "Shanghai" }],
    });
    const text = buildDeterministicScriAiSummary({
      title: body.title,
      shortSummary: body.shortSummary ?? null,
      longSummary: body.longSummary ?? null,
      eventType: body.eventType,
      eventTypeLabel: "Port congestion",
      severity: body.severity,
      confidence: body.confidence,
      geographies: body.geographies ?? [],
      sources: body.sources,
    });
    expect(text).toBeTruthy();
    expect(text).toContain("Known facts");
    expect(text).toContain("Interpretation");
    expect(text).toContain("does not fabricate");
  });
});

describe("resolveIngestAiFields", () => {
  it("uses connector text when provided", () => {
    const body = scriIngestBodySchema.parse({
      ingestKey: "k",
      eventType: "PORT_CONGESTION",
      title: "T",
      severity: "LOW",
      sources: [{ sourceType: "x" }],
      aiSummary: " From model ",
    });
    const r = resolveIngestAiFields(body);
    expect(r.aiSummary).toBe("From model");
    expect(r.aiSummarySource).toBe("CONNECTOR");
  });

  it("clears when null", () => {
    const body = scriIngestBodySchema.parse({
      ingestKey: "k2",
      eventType: "PORT_CONGESTION",
      title: "T",
      severity: "LOW",
      sources: [{ sourceType: "x" }],
      aiSummary: null,
    });
    const r = resolveIngestAiFields(body);
    expect(r.aiSummary).toBeNull();
    expect(r.aiSummarySource).toBeNull();
  });
});
