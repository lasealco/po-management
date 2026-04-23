import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildDeterministicScriAiSummary,
  resolveIngestAiFields,
  resolveIngestAiFieldsAsync,
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

describe("resolveIngestAiFieldsAsync", () => {
  const origKey = process.env.OPENAI_API_KEY;
  const origFlag = process.env.SCRI_INGEST_AI_LLM;

  afterEach(() => {
    process.env.OPENAI_API_KEY = origKey;
    process.env.SCRI_INGEST_AI_LLM = origFlag;
    vi.restoreAllMocks();
  });

  it("matches resolveIngestAiFields for connector-provided summary", async () => {
    const body = scriIngestBodySchema.parse({
      ingestKey: "k",
      eventType: "PORT_CONGESTION",
      title: "T",
      severity: "LOW",
      sources: [{ sourceType: "x" }],
      aiSummary: " From model ",
    });
    const sync = resolveIngestAiFields(body);
    const asyncR = await resolveIngestAiFieldsAsync(body);
    expect(asyncR).toEqual(sync);
  });

  it("uses deterministic template when OpenAI key missing", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.SCRI_INGEST_AI_LLM = "1";
    const body = scriIngestBodySchema.parse({
      ingestKey: "auto-1",
      eventType: "PORT_CONGESTION",
      title: "Port delay",
      severity: "HIGH",
      confidence: 70,
      sources: [{ sourceType: "news", url: "https://example.com/a" }],
    });
    const r = await resolveIngestAiFieldsAsync(body);
    expect(r.aiSummarySource).toBe("DETERMINISTIC_V1");
    expect(r.aiSummary).toContain("Known facts");
  });

  it("uses deterministic when no https source URL", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.SCRI_INGEST_AI_LLM = "1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const body = scriIngestBodySchema.parse({
      ingestKey: "auto-2",
      eventType: "PORT_CONGESTION",
      title: "Port delay",
      severity: "HIGH",
      confidence: 70,
      sources: [{ sourceType: "internal", headline: "Memo" }],
    });
    const r = await resolveIngestAiFieldsAsync(body);
    expect(r.aiSummarySource).toBe("DETERMINISTIC_V1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses OpenAI when key, flag, and https URL present", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.SCRI_INGEST_AI_LLM = "1";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "### Operator brief\nGrounded line citing Source [1]." } }],
        }),
      }),
    );

    const body = scriIngestBodySchema.parse({
      ingestKey: "auto-3",
      eventType: "PORT_CONGESTION",
      title: "Port delay",
      severity: "HIGH",
      confidence: 70,
      sources: [{ sourceType: "news", url: "https://example.com/article", headline: "Wire" }],
    });
    const r = await resolveIngestAiFieldsAsync(body);
    expect(r.aiSummarySource).toBe("OPENAI_GROUNDED_V1");
    expect(r.aiSummary).toContain("Operator brief");
  });
});
