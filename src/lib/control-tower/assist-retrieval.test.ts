import { describe, expect, it } from "vitest";

import { retrieveAssistSnippets } from "./assist-retrieval";

describe("retrieveAssistSnippets", () => {
  it("returns empty result for short queries", () => {
    expect(retrieveAssistSnippets("")).toEqual({
      hintLines: [],
      llmDetails: [],
      matchedIds: [],
    });
    expect(retrieveAssistSnippets("a")).toEqual({
      hintLines: [],
      llmDetails: [],
      matchedIds: [],
    });
  });

  it("matches corpus terms case-insensitively and returns summaries", () => {
    const r = retrieveAssistSnippets("how does the webhook work for inbound");
    expect(r.hintLines.length).toBeGreaterThan(0);
    expect(r.llmDetails.length).toBeGreaterThan(0);
    expect(r.matchedIds).toContain("inbound-webhook");
    expect(r.hintLines[0]).toContain("/api/integrations/control-tower/inbound");
  });

  it("respects maxHints and minScore", () => {
    const r = retrieveAssistSnippets("cron", { maxHints: 1, maxLlmDetails: 1, minScore: 1 });
    expect(r.hintLines).toHaveLength(1);
    expect(r.llmDetails).toHaveLength(1);
    expect(r.matchedIds).toHaveLength(1);
  });

  it("excludes snippets below minScore", () => {
    const r = retrieveAssistSnippets("webhook", { minScore: 50 });
    expect(r.hintLines).toEqual([]);
    expect(r.matchedIds).toEqual([]);
  });
});
