import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cosineSimilarity,
  isControlTowerAssistEmbeddingsEnabled,
  retrieveAssistSnippetsWithOptionalEmbeddings,
} from "./assist-retrieval-embed";

describe("assist-retrieval-embed", () => {
  it("cosineSimilarity is 1 for identical non-zero vectors", () => {
    const v = [0.6, 0.8, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("cosineSimilarity is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  const origEmb = process.env.CONTROL_TOWER_ASSIST_EMBEDDINGS;
  const origKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.CONTROL_TOWER_ASSIST_EMBEDDINGS = origEmb;
    process.env.OPENAI_API_KEY = origKey;
    vi.unstubAllGlobals();
  });

  it("returns keyword-only when embeddings flag is off", async () => {
    process.env.CONTROL_TOWER_ASSIST_EMBEDDINGS = "0";
    process.env.OPENAI_API_KEY = "sk-test";
    const r = await retrieveAssistSnippetsWithOptionalEmbeddings("webhook inbound carrier", {
      maxHints: 2,
      maxLlmDetails: 2,
      minScore: 1,
    });
    expect(r.usedEmbeddings).toBe(false);
    expect(r.matchedIds).toContain("inbound-webhook");
  });

  it("falls back to keyword when OpenAI embeddings fail", async () => {
    process.env.CONTROL_TOWER_ASSIST_EMBEDDINGS = "1";
    process.env.OPENAI_API_KEY = "sk-test";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, text: async () => "err" })));
    const r = await retrieveAssistSnippetsWithOptionalEmbeddings("webhook inbound", {
      maxHints: 2,
      maxLlmDetails: 2,
      minScore: 1,
    });
    expect(r.usedEmbeddings).toBe(false);
    expect(r.matchedIds).toContain("inbound-webhook");
  });

  it("uses hybrid ranking when OpenAI returns embeddings (same dim for all inputs)", async () => {
    process.env.CONTROL_TOWER_ASSIST_EMBEDDINGS = "1";
    process.env.OPENAI_API_KEY = "sk-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { input: string | string[] };
        const inputs = Array.isArray(body.input) ? body.input : [body.input];
        const dim = 12;
        return {
          ok: true,
          json: async () => ({
            data: inputs.map((_, i) => ({
              index: i,
              embedding: Array.from({ length: dim }, (_, j) => (j === (i % dim) ? 1 : 0)),
            })),
          }),
        };
      }),
    );

    const r = await retrieveAssistSnippetsWithOptionalEmbeddings(
      "idempotency milestone carrier feed integration visibility",
      { maxHints: 2, maxLlmDetails: 2, minScore: 1 },
    );
    expect(r.hintLines.length).toBeGreaterThan(0);
  });
});

describe("isControlTowerAssistEmbeddingsEnabled", () => {
  const orig = process.env.CONTROL_TOWER_ASSIST_EMBEDDINGS;
  afterEach(() => {
    process.env.CONTROL_TOWER_ASSIST_EMBEDDINGS = orig;
  });
  it("is true for 1", () => {
    process.env.CONTROL_TOWER_ASSIST_EMBEDDINGS = "1";
    expect(isControlTowerAssistEmbeddingsEnabled()).toBe(true);
  });
  it("is false when unset", () => {
    delete process.env.CONTROL_TOWER_ASSIST_EMBEDDINGS;
    expect(isControlTowerAssistEmbeddingsEnabled()).toBe(false);
  });
});
